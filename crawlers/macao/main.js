const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const { uploadImageToR2, generateFileName } = require('../shared/r2-uploader');
const { fetchPage, parseImageMaterials, parsePeriodFromPage, sleep } = require('../shared/crawler-utils');
require('dotenv').config();

// 加载资料配置
let materialsConfig = null;
async function loadMaterialsConfig() {
  if (!materialsConfig) {
    const configPath = path.join(__dirname, '../../config/materials-config.json');
    const data = await fs.readFile(configPath, 'utf-8');
    materialsConfig = JSON.parse(data);
  }
  return materialsConfig;
}

// 澳门资料爬虫主函数
async function crawlMacaoMaterials() {
  console.log('🚀 开始爬取澳门资料...\n');
  
  const startTime = Date.now();
  const results = {
    success: 0,
    failed: 0,
    materials: [],
  };

  try {
    // 加载配置
    const config = await loadMaterialsConfig();
    console.log(`📋 加载配置: ${Object.keys(config.types).length} 种资料类型\n`);

    // 获取当前期数
    const { year, period } = getCurrentPeriod();
    console.log(`📅 当前期数: ${year}年${String(period).padStart(3, '0')}期\n`);

    // 示例爬虫
    await crawlExampleSite(year, period, results);

    // 生成日志
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n' + '='.repeat(50));
    console.log('✅ 爬取完成!');
    console.log(`⏱️  耗时: ${duration}秒`);
    console.log(`✅ 成功: ${results.success} 个资料`);
    console.log(`❌ 失败: ${results.failed} 个资料`);
    console.log('='.repeat(50));

    // 保存日志
    await saveLog(year, period, results, duration);

  } catch (error) {
    console.error('\n❌ 爬取失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 示例爬虫
async function crawlExampleSite(year, period, results) {
  console.log('📡 爬取示例网站...\n');

  try {
    const exampleMaterials = [
      {
        type: 'yunchu-guanren',
        name: '云储官人',
        content: '示例数据 - 云储官人精选资料',
      },
      {
        type: 'zhenban-shepaitu',
        name: '正版射牌图',
        content: '示例数据 - 正版射牌图彩色图纸',
      },
      {
        type: 'aomen-zhengliao',
        name: '澳门正料',
        content: '示例数据 - 澳门正料精准推荐',
      },
    ];

    for (const material of exampleMaterials) {
      try {
        console.log(`  📝 处理: ${material.name}`);
        
        const dataKey = `macao/${year}/${String(period).padStart(3, '0')}/${material.type}/data.json`;
        const materialData = {
          lottery_type: 'macao',
          period: period,
          year: year,
          material_type: material.type,
          content: material.content,
          crawled_at: new Date().toISOString(),
        };
        
        results.materials.push(materialData);
        results.success++;
        console.log(`  ✅ ${material.name} 处理成功\n`);
        
        await sleep(1000);
      } catch (error) {
        console.error(`  ❌ ${material.name} 处理失败: ${error.message}\n`);
        results.failed++;
      }
    }

    console.log('💡 提示: 这是示例代码，实际使用时需要替换为真实的爬虫逻辑');
    console.log('💡 真实爬虫需要分析目标网站的 HTML 结构并提取数据\n');

  } catch (error) {
    console.error('❌ 示例网站爬取失败:', error.message);
    throw error;
  }
}

// 获取当前期数
function getCurrentPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  
  // 澳门六合彩：每周一、三、五开奖
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((now - startOfYear) / 86400000);
  
  const period = Math.floor(dayOfYear / 7 * 3) + 1;
  
  return { year, period: Math.min(period, 156) };
}

// 保存日志
async function saveLog(year, period, results, duration) {
  const logDir = path.join(__dirname, '../../logs');
  await fs.mkdir(logDir, { recursive: true });
  
  const logFile = path.join(logDir, `macao-${year}-${String(period).padStart(3, '0')}-${Date.now()}.json`);
  const logData = {
    lottery_type: 'macao',
    year,
    period,
    timestamp: new Date().toISOString(),
    duration: parseFloat(duration),
    success: results.success,
    failed: results.failed,
    materials: results.materials,
  };
  
  await fs.writeFile(logFile, JSON.stringify(logData, null, 2));
  console.log(`\n📄 日志已保存: ${logFile}`);
}

// 运行爬虫
if (require.main === module) {
  crawlMacaoMaterials().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { crawlMacaoMaterials };
