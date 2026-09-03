/**
 * 统一资料爬虫 - 支持香港+澳门100+种资料
 * 更新策略：
 * - 澳门：每天开奖（每天检查）
 * - 香港：两天一期（偶数天检查）
 * - 时间点：开奖后立即 + 凌晨3点 + 下午3点
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

// 加载完整资料配置
const materialsConfig = require('../../config/materials-100-full.json');
const scheduleConfig = require('../../config/crawler-schedule.json');

class UnifiedCrawler {
    constructor() {
        // Cloudflare R2 配置 (兼容 S3 API)
        this.r2Client = new S3Client({
            region: 'auto',
            endpoint: process.env.R2_ENDPOINT,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
            }
        });

        this.bucketName = process.env.R2_BUCKET_NAME || 'sixcai-materials';
        this.baseUrl = process.env.SOURCE_URL || 'https://49.gs.cn';
        
        // 本地临时存储
        this.tempDir = path.join(__dirname, '../../temp/downloads');
        
        // 统计信息
        this.stats = {
            total: 0,
            success: 0,
            failed: 0,
            skipped: 0
        };
    }

    /**
     * 判断今天是否需要爬取
     */
    shouldCrawlToday() {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=周日, 1=周一, ...
        const hour = now.getHours();

        const result = {
            macao: true,  // 澳门每天都开奖
            hongkong: false  // 香港两天一期
        };

        // 香港开奖日判断（周二=2、周四=4、周六=6）
        if ([2, 4, 6].includes(dayOfWeek)) {
            result.hongkong = true;
        }

        console.log(`[Schedule Check] Today: ${now.toLocaleDateString()}, DayOfWeek: ${dayOfWeek}, Hour: ${hour}`);
        console.log(`[Schedule Check] Should crawl - Macao: ${result.macao}, HongKong: ${result.hongkong}`);

        return result;
    }

    /**
     * 获取当前期数
     */
    async getCurrentPeriod(region) {
        try {
            const url = region === 'macao' 
                ? `${this.baseUrl}/macao/history` 
                : `${this.baseUrl}/hongkong/history`;
            
            const response = await axios.get(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            
            // 解析最新期数（根据实际网站结构调整）
            const latestPeriod = $('.lottery-result .period').first().text().trim();
            
            return latestPeriod || this.generatePeriodNumber(region);
        } catch (error) {
            console.error(`[Period Error] ${region}:`, error.message);
            // 失败时生成默认期数
            return this.generatePeriodNumber(region);
        }
    }

    /**
     * 生成期数（澳门每天一期，香港两天一期）
     */
    generatePeriodNumber(region) {
        const now = new Date();
        const year = now.getFullYear();
        
        if (region === 'macao') {
            // 澳门：从年初到今天的天数
            const startOfYear = new Date(year, 0, 1);
            const dayOfYear = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24)) + 1;
            return `${year}${String(dayOfYear).padStart(3, '0')}`;
        } else {
            // 香港：年初到今天的天数 / 2
            const startOfYear = new Date(year, 0, 1);
            const dayOfYear = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24)) + 1;
            const period = Math.floor(dayOfYear / 2);
            return `${year}${String(period).padStart(3, '0')}`;
        }
    }

    /**
     * 爬取单个资料
     */
    async crawlMaterial(materialCode, region, period) {
        try {
            const materialInfo = materialsConfig.types[materialCode];
            if (!materialInfo) {
                console.log(`[Skip] Material ${materialCode} not found in config`);
                this.stats.skipped++;
                return null;
            }

            // 检查资料所属地区
            if (materialInfo.category !== region) {
                this.stats.skipped++;
                return null;
            }

            console.log(`[Crawl] ${materialInfo.name} (${materialCode}) - Period: ${period}`);

            // 构建资料URL（根据实际网站结构调整）
            const materialUrl = `${this.baseUrl}/${region}/materials/${materialCode}/${period}`;
            
            const response = await axios.get(materialUrl, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': this.baseUrl
                },
                responseType: materialInfo.dataType === 'image' ? 'arraybuffer' : 'text'
            });

            // 根据资料类型处理
            if (materialInfo.dataType === 'image' || materialInfo.dataType === 'mixed') {
                // 图片类型：保存图片
                const imageData = response.data;
                const fileName = `${period}.jpg`;
                const r2Path = `materials/${region}/${materialCode}/2026/${fileName}`;
                
                await this.uploadToR2(imageData, r2Path, 'image/jpeg');
                
                this.stats.success++;
                return {
                    material: materialCode,
                    period,
                    type: 'image',
                    path: r2Path,
                    size: imageData.length
                };
            } else {
                // 号码类型：解析并保存数据
                const $ = cheerio.load(response.data);
                const numbers = this.parseNumbers($, materialInfo);
                
                // 保存到数据库（后续实现）
                const dataPath = `data/${region}/${materialCode}/${period}.json`;
                await this.uploadToR2(
                    Buffer.from(JSON.stringify(numbers)), 
                    dataPath, 
                    'application/json'
                );
                
                this.stats.success++;
                return {
                    material: materialCode,
                    period,
                    type: 'numbers',
                    data: numbers
                };
            }
        } catch (error) {
            console.error(`[Error] ${materialCode}:`, error.message);
            this.stats.failed++;
            return null;
        }
    }

    /**
     * 解析号码数据
     */
    parseNumbers($, materialInfo) {
        // 根据不同资料类型解析（简化版）
        const numbers = [];
        $('.number-item').each((i, el) => {
            numbers.push($(el).text().trim());
        });
        return numbers;
    }

    /**
     * 上传到 Cloudflare R2
     */
    async uploadToR2(data, key, contentType) {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: data,
            ContentType: contentType,
            CacheControl: 'public, max-age=31536000',
        });

        await this.r2Client.send(command);
        console.log(`[Upload] Success: ${key}`);
    }

    /**
     * 批量爬取所有资料
     */
    async crawlAll() {
        console.log('='.repeat(60));
        console.log('🚀 Unified Crawler Started');
        console.log('='.repeat(60));

        const startTime = Date.now();
        const schedule = this.shouldCrawlToday();

        // 爬取澳门资料
        if (schedule.macao) {
            console.log('\n📦 Crawling Macao Materials...');
            const macaoPeriod = await this.getCurrentPeriod('macao');
            console.log(`Current Macao Period: ${macaoPeriod}`);

            const macaoMaterials = Object.keys(materialsConfig.types)
                .filter(key => materialsConfig.types[key].category === 'macao');

            for (const materialCode of macaoMaterials) {
                await this.crawlMaterial(materialCode, 'macao', macaoPeriod);
                await this.delay(500); // 防止请求过快
            }
        }

        // 爬取香港资料
        if (schedule.hongkong) {
            console.log('\n📦 Crawling HongKong Materials...');
            const hkPeriod = await this.getCurrentPeriod('hongkong');
            console.log(`Current HongKong Period: ${hkPeriod}`);

            const hkMaterials = Object.keys(materialsConfig.types)
                .filter(key => materialsConfig.types[key].category === 'hongkong');

            for (const materialCode of hkMaterials) {
                await this.crawlMaterial(materialCode, 'hongkong', hkPeriod);
                await this.delay(500);
            }
        }

        // 统计报告
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log('\n' + '='.repeat(60));
        console.log('✅ Crawler Completed');
        console.log('='.repeat(60));
        console.log(`Total: ${this.stats.total}`);
        console.log(`Success: ${this.stats.success}`);
        console.log(`Failed: ${this.stats.failed}`);
        console.log(`Skipped: ${this.stats.skipped}`);
        console.log(`Duration: ${duration}s`);
        console.log('='.repeat(60));

        return this.stats;
    }

    /**
     * 延迟函数
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 运行爬虫
if (require.main === module) {
    const crawler = new UnifiedCrawler();
    crawler.crawlAll()
        .then(stats => {
            console.log('\n✅ All done!');
            process.exit(stats.failed > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('\n❌ Fatal Error:', error);
            process.exit(1);
        });
}

module.exports = UnifiedCrawler;