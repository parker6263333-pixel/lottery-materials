/**
 * 🎰 简化版爬虫 - 专门爬取开奖数据
 * 用于 lottery-materials GitHub 项目
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

// 配置
const CONFIG = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  timeout: 30000,
  sources: {
    macao: {
      url: 'https://www.macaujc.com/',
      fallback: 'https://49tuku.com/am/',
      name: '澳门六合彩'
    },
    hongkong: {
      url: 'https://www.1234kj.com/',
      fallback: 'https://49tuku.com/hk/',
      name: '香港六合彩'
    }
  },
  // 模拟数据（用于测试）
  useMockData: true  // 先用模拟数据测试
};

/**
 * 生成模拟数据（用于测试）
 */
function generateMockData(region, count = 10) {
  const results = [];
  const today = new Date();
  
  for (let i = 0; i < count; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // 生成随机号码（1-49）
    const numbers = [];
    while (numbers.length < 6) {
      const num = Math.floor(Math.random() * 49) + 1;
      if (!numbers.includes(num)) {
        numbers.push(num);
      }
    }
    numbers.sort((a, b) => a - b);
    
    const special = Math.floor(Math.random() * 49) + 1;
    const period = region === 'macao' ? (245 - i).toString() : (234 - i).toString();
    
    results.push({
      period: period,
      date: date.toISOString().split('T')[0],
      numbers: numbers,
      special: special,
      region: region
    });
  }
  
  return results;
}

/**
 * 爬取澳门开奖数据
 */
async function scrapeMacao() {
  console.log('🎰 开始爬取澳门六合彩数据...');
  
  // 如果启用模拟数据
  if (CONFIG.useMockData) {
    console.log('ℹ️  使用模拟数据（测试模式）');
    const mockData = generateMockData('macao', 10);
    console.log(`✅ 澳门数据: 生成 ${mockData.length} 期模拟数据`);
    return mockData;
  }
  
  try {
    const response = await axios.get(CONFIG.sources.macao.url, {
      timeout: CONFIG.timeout,
      headers: { 'User-Agent': CONFIG.userAgent }
    });
    
    const $ = cheerio.load(response.data);
    const results = [];
    
    // 提取开奖数据（需要根据实际页面结构调整）
    $('.lottery-result-item, .result-row, tr').each((i, elem) => {
      if (i >= 10) return false; // 只取最近10期
      
      const $elem = $(elem);
      
      // 尝试提取期数
      const periodText = $elem.find('.period, .issue, td:first-child').text().trim();
      const periodMatch = periodText.match(/(\d+)/);
      
      if (!periodMatch) return;
      
      const period = periodMatch[1];
      
      // 提取开奖号码
      const numbers = [];
      $elem.find('.ball, .number, .num, td').each((j, ball) => {
        const num = $(ball).text().trim();
        if (/^\d{1,2}$/.test(num)) {
          numbers.push(parseInt(num));
        }
      });
      
      // 至少需要6个正码 + 1个特码
      if (numbers.length >= 7) {
        results.push({
          period: period,
          date: new Date().toISOString().split('T')[0],
          numbers: numbers.slice(0, 6),
          special: numbers[6],
          region: 'macao'
        });
      }
    });
    
    console.log(`✅ 澳门数据: 采集到 ${results.length} 期`);
    return results;
    
  } catch (error) {
    console.error('❌ 澳门爬取失败:', error.message);
    return [];
  }
}

/**
 * 爬取香港开奖数据
 */
async function scrapeHongkong() {
  console.log('🎰 开始爬取香港六合彩数据...');
  
  // 如果启用模拟数据
  if (CONFIG.useMockData) {
    console.log('ℹ️  使用模拟数据（测试模式）');
    const mockData = generateMockData('hongkong', 10);
    console.log(`✅ 香港数据: 生成 ${mockData.length} 期模拟数据`);
    return mockData;
  }
  
  try {
    const response = await axios.get(CONFIG.sources.hongkong.url, {
      timeout: CONFIG.timeout,
      headers: { 'User-Agent': CONFIG.userAgent }
    });
    
    const $ = cheerio.load(response.data);
    const results = [];
    
    // 提取开奖数据
    $('.lottery-result-item, .result-row, tr').each((i, elem) => {
      if (i >= 10) return false; // 只取最近10期
      
      const $elem = $(elem);
      
      // 提取期数
      const periodText = $elem.find('.period, .issue, td:first-child').text().trim();
      const periodMatch = periodText.match(/(\d+)/);
      
      if (!periodMatch) return;
      
      const period = periodMatch[1];
      
      // 提取开奖号码
      const numbers = [];
      $elem.find('.ball, .number, .num, td').each((j, ball) => {
        const num = $(ball).text().trim();
        if (/^\d{1,2}$/.test(num)) {
          numbers.push(parseInt(num));
        }
      });
      
      // 至少需要6个正码 + 1个特码
      if (numbers.length >= 7) {
        results.push({
          period: period,
          date: new Date().toISOString().split('T')[0],
          numbers: numbers.slice(0, 6),
          special: numbers[6],
          region: 'hongkong'
        });
      }
    });
    
    console.log(`✅ 香港数据: 采集到 ${results.length} 期`);
    return results;
    
  } catch (error) {
    console.error('❌ 香港爬取失败:', error.message);
    return [];
  }
}

/**
 * 保存数据到 JSON 文件
 */
async function saveData(macaoData, hongkongData) {
  const dataPath = path.join(__dirname, 'data', 'lottery-data.json');
  
  const data = {
    version: '1.0.0',
    lastUpdate: new Date().toISOString(),
    description: '香港六合彩和澳门六合彩开奖数据',
    source: '自动爬虫采集',
    hongkong: hongkongData,
    macao: macaoData
  };
  
  try {
    await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log('✅ 数据已保存:', dataPath);
  } catch (error) {
    console.error('❌ 保存数据失败:', error.message);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🤖 六合彩开奖数据爬虫');
  console.log('⏰ 启动时间:', new Date().toLocaleString('zh-CN'));
  console.log('='.repeat(60) + '\n');
  
  // 爬取数据
  const macaoData = await scrapeMacao();
  await new Promise(resolve => setTimeout(resolve, 2000)); // 延迟2秒
  const hongkongData = await scrapeHongkong();
  
  // 保存数据
  await saveData(macaoData, hongkongData);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 爬取统计:');
  console.log(`   澳门: ${macaoData.length} 期`);
  console.log(`   香港: ${hongkongData.length} 期`);
  console.log('⏰ 完成时间:', new Date().toLocaleString('zh-CN'));
  console.log('='.repeat(60) + '\n');
}

// 运行
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 程序异常:', error);
    process.exit(1);
  });
}

module.exports = { main, scrapeMacao, scrapeHongkong };
