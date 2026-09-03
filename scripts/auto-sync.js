/**
 * 自动同步脚本 - 无需手动干预
 * 功能：自动检测对标网站新期数，自动下载并更新到本站
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

// ============ 配置区域 ============
const CONFIG = {
    // 对标网站域名
    targetSite: 'https://zmakkcifcgdyaqzt.490266.cyou',
    
    // CDN域名
    cdnDomain: 'https://donk666.duokkq.com',
    
    // 本地数据存储路径
    dataPath: path.join(__dirname, '../data'),
    
    // 检测间隔（毫秒）
    checkInterval: 5 * 60 * 1000, // 5分钟
    
    // 资料配置
    materials: {
        macao: [
            { id: 28089, code: 'ampgt', name: '澳门跑狗图', category: 'paogou' },
            // TODO: 添加其他29种资料
        ],
        hongkong: [
            // TODO: 添加香港彩资料
        ]
    }
};

// ============ 核心功能 ============

/**
 * 检查对标网站最新期数
 */
async function checkLatestPeriod(lotteryType = 'macao') {
    try {
        console.log(`[${new Date().toLocaleString()}] 检查最新期数...`);
        
        // 方法1: 尝试访问最新期数的图片
        // 从当前日期推算可能的期数
        const today = new Date();
        const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
        
        // 测试最近10期
        for (let i = 0; i < 10; i++) {
            const period = dayOfYear - i;
            const testURL = `${CONFIG.cdnDomain}/tk_data/2026/${lotteryType}/color/${period}/ampgt.jpg`;
            
            const exists = await checkImageExists(testURL);
            if (exists) {
                console.log(`✓ 发现最新期数: ${period}`);
                return period;
            }
        }
        
        return null;
    } catch (error) {
        console.error('检查期数失败:', error.message);
        return null;
    }
}

/**
 * 检查图片是否存在
 */
async function checkImageExists(url) {
    try {
        const response = await axios.head(url, { timeout: 5000 });
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

/**
 * 获取本地最新期数
 */
async function getLocalLatestPeriod(lotteryType = 'macao') {
    try {
        const dataFile = path.join(CONFIG.dataPath, `${lotteryType}_latest.json`);
        const data = await fs.readFile(dataFile, 'utf-8');
        const json = JSON.parse(data);
        return json.latestPeriod || 0;
    } catch (error) {
        return 0;
    }
}

/**
 * 保存本地最新期数
 */
async function saveLocalLatestPeriod(lotteryType, period) {
    const dataFile = path.join(CONFIG.dataPath, `${lotteryType}_latest.json`);
    await fs.writeFile(dataFile, JSON.stringify({
        latestPeriod: period,
        updateTime: new Date().toISOString()
    }, null, 2));
}

/**
 * 下载单个资料的图片
 */
async function downloadMaterial(material, period, lotteryType) {
    try {
        const imageURL = `${CONFIG.cdnDomain}/tk_data/2026/${lotteryType}/color/${period}/${material.code}.jpg`;
        
        console.log(`  → 下载 ${material.name} 第${period}期...`);
        
        const response = await axios.get(imageURL, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': CONFIG.targetSite
            }
        });
        
        // 保存图片
        const savePath = path.join(
            CONFIG.dataPath,
            'gallery',
            lotteryType,
            material.category,
            '2026',
            `${period}.jpg`
        );
        
        await fs.mkdir(path.dirname(savePath), { recursive: true });
        await fs.writeFile(savePath, response.data);
        
        console.log(`  ✓ ${material.name} 下载成功`);
        return true;
    } catch (error) {
        console.error(`  ✗ ${material.name} 下载失败:`, error.message);
        return false;
    }
}

/**
 * 下载所有资料
 */
async function downloadAllMaterials(period, lotteryType = 'macao') {
    console.log(`\n[下载] 开始下载第${period}期所有资料...`);
    
    const materials = CONFIG.materials[lotteryType];
    const results = [];
    
    for (const material of materials) {
        const success = await downloadMaterial(material, period, lotteryType);
        results.push({ material: material.name, success });
        
        // 间隔1秒，避免请求过快
        await sleep(1000);
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`\n[下载] 完成！成功: ${successCount}/${materials.length}`);
    
    return successCount > 0;
}

/**
 * 生成JSON数据文件
 */
async function generateDataFiles(period, lotteryType = 'macao') {
    console.log(`\n[生成] 生成第${period}期数据文件...`);
    
    const materials = CONFIG.materials[lotteryType];
    
    for (const material of materials) {
        const data = {
            code: material.code,
            name: material.name,
            year: 2026,
            period: String(period).padStart(3, '0'),
            date: new Date().toISOString().split('T')[0],
            type: 'image',
            content: {
                image: `/assets/images/gallery/${lotteryType}/${material.category}/2026/${period}.jpg`,
                thumbnail: `/assets/images/gallery/${lotteryType}/${material.category}/2026/${period}.jpg`
            }
        };
        
        const dataFile = path.join(
            CONFIG.dataPath,
            'materials',
            lotteryType,
            material.code,
            '2026',
            `${String(period).padStart(3, '0')}.json`
        );
        
        await fs.mkdir(path.dirname(dataFile), { recursive: true });
        await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
    }
    
    console.log(`[生成] 完成！`);
}

/**
 * 发送通知（可选）
 */
async function sendNotification(message) {
    console.log(`\n[通知] ${message}`);
    
    // TODO: 接入通知服务
    // 1. 邮件通知
    // 2. 微信通知
    // 3. Telegram通知
    // 4. 钉钉/企业微信通知
}

/**
 * 主同步流程
 */
async function syncMaterials() {
    try {
        console.log('\n========================================');
        console.log(`[同步] 开始检查更新 ${new Date().toLocaleString()}`);
        console.log('========================================');
        
        // 1. 检查最新期数
        const latestPeriod = await checkLatestPeriod('macao');
        if (!latestPeriod) {
            console.log('[同步] 未检测到新期数');
            return;
        }
        
        // 2. 获取本地已有期数
        const localPeriod = await getLocalLatestPeriod('macao');
        
        // 3. 判断是否需要更新
        if (latestPeriod <= localPeriod) {
            console.log(`[同步] 已是最新（第${localPeriod}期）`);
            return;
        }
        
        console.log(`\n[同步] 发现新期数！`);
        console.log(`  本地: 第${localPeriod}期`);
        console.log(`  最新: 第${latestPeriod}期`);
        console.log(`  需要更新 ${latestPeriod - localPeriod} 期`);
        
        // 4. 下载新期数据
        const downloadSuccess = await downloadAllMaterials(latestPeriod, 'macao');
        
        if (downloadSuccess) {
            // 5. 生成数据文件
            await generateDataFiles(latestPeriod, 'macao');
            
            // 6. 更新本地记录
            await saveLocalLatestPeriod('macao', latestPeriod);
            
            // 7. 发送通知
            await sendNotification(`网站已更新第${latestPeriod}期资料`);
            
            console.log('\n[同步] ✓ 同步完成！');
        } else {
            console.log('\n[同步] ✗ 同步失败，将在下次重试');
        }
        
    } catch (error) {
        console.error('\n[错误]', error.message);
    }
}

/**
 * 辅助函数：延时
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ 启动服务 ============

async function start() {
    console.log('========================================');
    console.log('   自动同步服务已启动');
    console.log(`   检测间隔: ${CONFIG.checkInterval / 1000 / 60} 分钟`);
    console.log('========================================\n');
    
    // 立即执行一次
    await syncMaterials();
    
    // 定时执行
    setInterval(syncMaterials, CONFIG.checkInterval);
}

// 如果直接运行此文件
if (require.main === module) {
    start();
}

module.exports = { syncMaterials, checkLatestPeriod, downloadAllMaterials };
