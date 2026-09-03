// 港澳六合彩爬虫
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { existsSync, mkdirSync } = require('fs');

class MacaoCrawler {
    constructor() {
        this.baseUrl = process.env.SOURCE_URL || 'https://49.gs.cn';
        this.downloadDir = path.join(__dirname, '../../temp/downloads');
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
        
        // 确保下载目录存在
        if (!existsSync(this.downloadDir)) {
            mkdirSync(this.downloadDir, { recursive: true });
        }
    }

    /**
     * 获取资料列表（从数据库配置）
     */
    getMaterialConfigs() {
        return [
            { id: 'macao_paogoutu', name: '跑狗图', path: '/paogoutu/' },
            { id: 'macao_guanjiap', name: '管家婆', path: '/guanjiap/' },
            { id: 'macao_lingbo', name: '凌波微步', path: '/lingbo/' },
            { id: 'macao_yunchu', name: '云楚官人', path: '/yunchu/' },
            { id: 'macao_jingzhun24', name: '精准24码', path: '/jingzhun24/' },
            // ... 可扩展到100+种资料
        ];
    }

    /**
     * 爬取单个资料的最新期数
     * @param {Object} material - 资料配置
     */
    async crawlMaterial(material) {
        try {
            console.log(`\n🔍 开始爬取: ${material.name}`);
            
            const url = `${this.baseUrl}${material.path}`;
            const response = await axios.get(url, {
                headers: { 'User-Agent': this.userAgent },
                timeout: 30000
            });

            const $ = cheerio.load(response.data);
            const results = [];

            // 解析页面获取最新期数图片
            // 注意：实际选择器需要根据目标网站结构调整
            $('.material-item').each((index, element) => {
                const periodText = $(element).find('.period').text().trim();
                const imageUrl = $(element).find('img').attr('src');
                const dateText = $(element).find('.date').text().trim();

                if (periodText && imageUrl) {
                    const period = this.extractPeriod(periodText);
                    const year = new Date().getFullYear();
                    
                    results.push({
                        materialId: material.id,
                        period,
                        year,
                        imageUrl: this.resolveUrl(imageUrl),
                        drawDate: this.parseDate(dateText)
                    });
                }
            });

            console.log(`✅ 找到 ${results.length} 期数据`);
            return results;

        } catch (error) {
            console.error(`❌ 爬取失败 [${material.name}]:`, error.message);
            return [];
        }
    }

    /**
     * 下载图片
     * @param {string} imageUrl - 图片URL
     * @param {string} materialId - 资料ID
     * @param {string} year - 年份
     * @param {string} period - 期数
     */
    async downloadImage(imageUrl, materialId, year, period) {
        try {
            const filename = `${materialId}_${year}_${period}.jpg`;
            const filepath = path.join(this.downloadDir, filename);

            // 如果已存在则跳过
            if (existsSync(filepath)) {
                console.log(`⏭️  已存在，跳过: ${period}`);
                return { success: true, path: filepath, skipped: true };
            }

            // 下载图片
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                headers: { 'User-Agent': this.userAgent },
                timeout: 30000
            });

            // 使用sharp优化图片（压缩、转换格式）
            await sharp(response.data)
                .jpeg({ quality: 85, progressive: true })
                .resize(1200, null, { 
                    fit: 'inside',
                    withoutEnlargement: true 
                })
                .toFile(filepath);

            const stats = await fs.stat(filepath);
            const sizeKB = (stats.size / 1024).toFixed(2);
            
            console.log(`✅ 下载完成: ${period} (${sizeKB} KB)`);
            
            return { 
                success: true, 
                path: filepath,
                size: stats.size,
                skipped: false
            };

        } catch (error) {
            console.error(`❌ 下载失败 [${period}]:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 批量下载资料图片
     * @param {Array} items - 期数数据数组
     */
    async downloadBatch(items) {
        const results = [];
        
        for (const item of items) {
            const result = await this.downloadImage(
                item.imageUrl,
                item.materialId,
                item.year,
                item.period
            );
            
            results.push({
                ...item,
                download: result
            });

            // 延迟避免被封
            await this.sleep(1000);
        }

        return results;
    }

    /**
     * 完整爬取流程
     * @param {Array} materialIds - 要爬取的资料ID数组（可选，默认全部）
     */
    async crawlAll(materialIds = null) {
        console.log('🚀 开始自动爬取任务\n');
        
        const materials = this.getMaterialConfigs();
        const targetMaterials = materialIds 
            ? materials.filter(m => materialIds.includes(m.id))
            : materials;

        const allResults = [];

        for (const material of targetMaterials) {
            // 1. 爬取期数列表
            const periods = await this.crawlMaterial(material);
            
            if (periods.length === 0) {
                console.log(`⚠️  ${material.name} 没有新数据`);
                continue;
            }

            // 2. 下载图片
            const downloads = await this.downloadBatch(periods);
            allResults.push(...downloads);

            console.log(`\n✅ ${material.name} 完成\n`);
        }

        // 统计结果
        const summary = {
            total: allResults.length,
            success: allResults.filter(r => r.download.success).length,
            skipped: allResults.filter(r => r.download.skipped).length,
            failed: allResults.filter(r => !r.download.success).length
        };

        console.log('\n📊 爬取任务完成！');
        console.log(`   总计: ${summary.total}`);
        console.log(`   成功: ${summary.success}`);
        console.log(`   跳过: ${summary.skipped}`);
        console.log(`   失败: ${summary.failed}`);

        return allResults;
    }

    // 工具方法
    extractPeriod(text) {
        const match = text.match(/(\d{3})/);
        return match ? match[1] : null;
    }

    resolveUrl(url) {
        if (url.startsWith('http')) return url;
        if (url.startsWith('//')) return 'https:' + url;
        return this.baseUrl + url;
    }

    parseDate(dateText) {
        // 解析日期文本，转换为标准格式
        // 需要根据实际网站格式调整
        return dateText || null;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = MacaoCrawler;
