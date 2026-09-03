#!/usr/bin/env node

/**
 * 港澳六合彩资料自动爬虫
 * 
 * 功能：
 * 1. 检查49图库等网站的最新资料
 * 2. 下载新一期图片
 * 3. 压缩优化（保持清晰度）
 * 4. 上传到Cloudflare R2
 * 5. 更新D1数据库
 */

require('dotenv').config();
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// ==================== 配置 ====================

const CONFIG = {
  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL,
  },
  crawler: {
    userAgent: process.env.CRAWLER_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    delay: parseInt(process.env.CRAWLER_DELAY_MS) || 2000,
    retryTimes: parseInt(process.env.CRAWLER_RETRY_TIMES) || 3,
  },
  materials: [
    {
      typeId: 'paogoutu',
      name: '跑狗图',
      sourceUrl: 'https://49pic.com/paogoutu',
      selector: 'img.material-image',  // 需要根据实际网站调整
    },
    {
      typeId: 'guanjiapo',
      name: '管家婆',
      sourceUrl: 'https://49pic.com/guanjiapo',
      selector: 'img.material-image',
    },
    {
      typeId: 'lingbovibu',
      name: '凌波微步',
      sourceUrl: 'https://49pic.com/lingbo',
      selector: 'img.material-image',
    },
    {
      typeId: 'yunchuguanren',
      name: '云楚官人',
      sourceUrl: 'https://49pic.com/yunchu',
      selector: 'img.material-image',
    },
  ],
};

// ==================== R2 客户端初始化 ====================

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${CONFIG.r2.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: CONFIG.r2.accessKeyId,
    secretAccessKey: CONFIG.r2.secretAccessKey,
  },
});

// ==================== 工具函数 ====================

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 获取当前年份和最新期数
 */
function getCurrentPeriodInfo() {
  const now = new Date();
  const year = now.getFullYear();
  
  // 简化计算：假设每周3期（周二、周四、周六）
  const startOfYear = new Date(year, 0, 1);
  const daysSinceStart = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
  const weeksSinceStart = Math.floor(daysSinceStart / 7);
  const period = weeksSinceStart * 3 + (now.getDay() >= 2 ? 1 : 0);
  
  return {
    year,
    period: String(period).padStart(3, '0'),
  };
}

/**
 * 检查R2中是否已存在该文件
 */
async function checkR2FileExists(key) {
  try {
    await r2Client.send(new HeadObjectCommand({
      Bucket: CONFIG.r2.bucketName,
      Key: key,
    }));
    return true;
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

/**
 * 下载图片
 */
async function downloadImage(url, retries = CONFIG.crawler.retryTimes) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`📥 下载图片: ${url} (尝试 ${i + 1}/${retries})`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': CONFIG.crawler.userAgent,
          'Referer': 'https://49pic.com/',
        },
        timeout: 30000,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const buffer = await response.buffer();
      console.log(`✅ 下载成功: ${(buffer.length / 1024).toFixed(2)} KB`);
      
      return buffer;
    } catch (error) {
      console.error(`❌ 下载失败 (${i + 1}/${retries}): ${error.message}`);
      
      if (i < retries - 1) {
        await sleep(CONFIG.crawler.delay * (i + 1));
      } else {
        throw error;
      }
    }
  }
}

/**
 * 压缩优化图片
 */
async function optimizeImage(buffer) {
  console.log(`🔧 压缩优化图片...`);
  
  const optimized = await sharp(buffer)
    .resize(800, null, {  // 宽度800px，高度自适应
      withoutEnlargement: true,
      fit: 'inside',
    })
    .jpeg({
      quality: 85,
      progressive: true,
      mozjpeg: true,
    })
    .toBuffer();
  
  const originalSize = (buffer.length / 1024).toFixed(2);
  const optimizedSize = (optimized.length / 1024).toFixed(2);
  const ratio = ((1 - optimized.length / buffer.length) * 100).toFixed(1);
  
  console.log(`✅ 压缩完成: ${originalSize}KB → ${optimizedSize}KB (节省${ratio}%)`);
  
  return optimized;
}

/**
 * 上传到R2
 */
async function uploadToR2(buffer, key, contentType = 'image/jpeg') {
  console.log(`☁️  上传到 R2: ${key}`);
  
  await r2Client.send(new PutObjectCommand({
    Bucket: CONFIG.r2.bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  
  const publicUrl = `${CONFIG.r2.publicUrl}/${key}`;
  console.log(`✅ 上传成功: ${publicUrl}`);
  
  return publicUrl;
}

/**
 * 爬取单个资料的最新期数
 */
async function crawlMaterial(material) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎯 开始爬取: ${material.name} (${material.typeId})`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    // 获取当前期数信息
    const { year, period } = getCurrentPeriodInfo();
    
    // 检查是否已存在
    const r2Key = `materials/macao/${material.typeId}/${year}/${period}.jpg`;
    const exists = await checkR2FileExists(r2Key);
    
    if (exists) {
      console.log(`⏭️  跳过: 第${period}期已存在`);
      return { success: true, skipped: true, period };
    }
    
    // 获取源网站HTML
    console.log(`🌐 访问源网站: ${material.sourceUrl}`);
    const response = await fetch(material.sourceUrl, {
      headers: {
        'User-Agent': CONFIG.crawler.userAgent,
      },
      timeout: 30000,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // 查找最新期图片URL（需要根据实际网站结构调整）
    const imageElement = $(material.selector).first();
    const imageUrl = imageElement.attr('src') || imageElement.attr('data-src');
    
    if (!imageUrl) {
      throw new Error('未找到图片URL，可能需要调整选择器');
    }
    
    console.log(`🖼️  找到图片: ${imageUrl}`);
    
    // 下载图片
    await sleep(CONFIG.crawler.delay);
    const imageBuffer = await downloadImage(imageUrl);
    
    // 压缩优化
    const optimizedBuffer = await optimizeImage(imageBuffer);
    
    // 上传到R2
    const publicUrl = await uploadToR2(optimizedBuffer, r2Key);
    
    console.log(`\n✅ ${material.name} 第${period}期处理完成`);
    
    return {
      success: true,
      skipped: false,
      period,
      year,
      imageUrl: publicUrl,
      fileSize: optimizedBuffer.length,
    };
    
  } catch (error) {
    console.error(`\n❌ ${material.name} 爬取失败: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 更新D1数据库（通过Cloudflare API）
 */
async function updateD1Database(results) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`💾 更新 D1 数据库`);
  console.log(`${'='.repeat(60)}`);
  
  const successResults = results.filter(r => r.success && !r.skipped);
  
  if (successResults.length === 0) {
    console.log(`ℹ️  没有新数据需要写入数据库`);
    return;
  }
  
  // 这里需要使用 Cloudflare Workers API 或 Wrangler CLI 来更新 D1
  // 简化示例：输出 SQL 语句
  console.log(`\n📝 需要执行的 SQL 语句:`);
  
  for (const result of successResults) {
    const sql = `
INSERT INTO macao_materials (material_type, period, year, image_url, file_size, date)
VALUES ('${result.materialType}', '${result.period}', ${result.year}, '${result.imageUrl}', ${result.fileSize}, '${new Date().toISOString().split('T')[0]}')
ON CONFLICT(material_type, period, year) DO UPDATE SET
  image_url = excluded.image_url,
  file_size = excluded.file_size;
    `.trim();
    
    console.log(sql);
    console.log('');
  }
  
  console.log(`💡 提示: 在生产环境中，这些SQL将通过Cloudflare Workers API自动执行`);
}

// ==================== 主函数 ====================

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 港澳六合彩资料自动爬虫启动`);
  console.log(`⏰ 运行时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  console.log(`${'='.repeat(60)}\n`);
  
  // 检查配置
  if (!CONFIG.r2.accessKeyId || !CONFIG.r2.secretAccessKey) {
    console.error(`❌ 错误: 缺少 R2 配置，请检查 .env 文件`);
    process.exit(1);
  }
  
  const results = [];
  
  // 爬取所有资料
  for (const material of CONFIG.materials) {
    const result = await crawlMaterial(material);
    results.push({
      ...result,
      materialType: material.typeId,
      materialName: material.name,
    });
    
    // 间隔延迟，避免被反爬
    if (CONFIG.materials.indexOf(material) < CONFIG.materials.length - 1) {
      await sleep(CONFIG.crawler.delay);
    }
  }
  
  // 更新数据库
  await updateD1Database(results);
  
  // 统计结果
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 执行统计`);
  console.log(`${'='.repeat(60)}`);
  
  const successful = results.filter(r => r.success && !r.skipped).length;
  const skipped = results.filter(r => r.skipped).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ 成功: ${successful} 个`);
  console.log(`⏭️  跳过: ${skipped} 个`);
  console.log(`❌ 失败: ${failed} 个`);
  
  if (failed > 0) {
    console.log(`\n失败详情:`);
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  • ${r.materialName}: ${r.error}`);
      });
  }
  
  console.log(`\n🎉 爬虫任务完成！`);
  
  // 如果有失败，返回错误码
  process.exit(failed > 0 ? 1 : 0);
}

// 执行
if (require.main === module) {
  main().catch(error => {
    console.error(`\n💥 致命错误: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = { crawlMaterial, optimizeImage, uploadToR2 };
