const axios = require('axios');
const cheerio = require('cheerio');

// 常用的六合彩网站列表
const HONGKONG_SOURCES = [
  {
    name: '香港正版资料大全',
    url: 'https://www.example-hk1.com',
    type: 'images',
  },
  {
    name: '香港资料库',
    url: 'https://www.example-hk2.com',
    type: 'data',
  },
];

// 爬取网页内容
async function fetchPage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`  🌐 访问: ${url} (尝试 ${i + 1}/${retries})`);
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Referer': 'https://www.google.com/',
        },
      });
      console.log(`  ✅ 访问成功`);
      return response.data;
    } catch (error) {
      console.error(`  ❌ 访问失败 (尝试 ${i + 1}/${retries}): ${error.message}`);
      if (i === retries - 1) throw error;
      await sleep(2000 * (i + 1)); // 指数退避
    }
  }
}

// 解析图片资料
function parseImageMaterials($, baseUrl) {
  const materials = [];
  
  // 示例：查找所有图片
  $('img').each((i, elem) => {
    const src = $(elem).attr('src');
    const alt = $(elem).attr('alt') || '';
    
    if (src && (src.includes('jpg') || src.includes('png') || src.includes('gif'))) {
      const fullUrl = src.startsWith('http') ? src : new URL(src, baseUrl).href;
      materials.push({
        type: 'image',
        url: fullUrl,
        alt: alt,
      });
    }
  });
  
  return materials;
}

// 解析期数和年份
function parsePeriodFromPage($) {
  // 尝试从页面中提取期数
  const text = $.text();
  
  // 匹配 "2026年001期" 或 "001期"
  const match = text.match(/(\d{4})年?(\d{3})期/);
  if (match) {
    return {
      year: parseInt(match[1]),
      period: parseInt(match[2]),
    };
  }
  
  // 默认返回当前日期
  const now = new Date();
  const year = now.getFullYear();
  const dayOfYear = Math.floor((now - new Date(year, 0, 0)) / 86400000);
  const period = Math.floor(dayOfYear / 3); // 粗略估计
  
  return { year, period };
}

// 睡眠函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  HONGKONG_SOURCES,
  fetchPage,
  parseImageMaterials,
  parsePeriodFromPage,
  sleep,
};
