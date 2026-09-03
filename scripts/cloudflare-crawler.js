/**
 * 🤖 Cloudflare 完整自动爬虫系统
 * 支持100+资料 + 多时段更新 + 全年历史数据
 * 优化版：不拖慢用户体验 + 智能限流
 */

const axios = require('axios');
const cheerio = require('cheerio');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

// ============ 加载配置 ============
const CONFIG_PATH = path.join(__dirname, '../config/materials-complete.json');
let FULL_CONFIG = {};

async function loadConfig() {
  const configContent = await fs.readFile(CONFIG_PATH, 'utf-8');
  FULL_CONFIG = JSON.parse(configContent);
  console.log('✅ 配置加载完成');
  console.log(`📊 澳门资料数: ${FULL_CONFIG.materials.macao.length}`);
  console.log(`📊 香港资料数: ${FULL_CONFIG.materials.hongkong?.length || 0}`);
  console.log(`📊 台湾资料数（预留）: ${FULL_CONFIG.materials.taiwan.length}`);
}

// ============ Cloudflare R2 客户端 ============
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// ============ 工具函数 ============

/**
 * 延迟函数（限流用）
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 获取当前期数
 */
async function getCurrentPeriod(region) {
  const now = new Date();
  const year = now.getFullYear();
  
  if (region === 'macao') {
    // 澳门每天一期，计算当前是第几期
    const startOfYear = new Date(year, 0, 1);
    const dayOfYear = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24)) + 1;
    return { year, period: dayOfYear };
  } else if (region === 'hongkong') {
    // 香港每周3期（二、四、六），估算期数
    const startOfYear = new Date(year, 0, 1);
    const weeks = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24 * 7));
    return { year, period: weeks * 3 };
  }
  
  return { year, period: 1 };
}

/**
 * 检查R2中是否已存在该资料
 */
async function checkIfExists(region, materialId, year, period) {
  const key = `materials/${region}/${materialId}/${year}/${period}.jpg`;
  
  try {
    await r2Client.send(new HeadObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || 'lottery-materials',
      Key: key,
    }));
    return true; // 存在
  } catch (error) {
    if (error.name === 'NotFound') {
      return false; // 不存在
    }
    console.error(`❌ 检查文件存在性失败: ${key}`, error.message);
    return false;
  }
}

/**
 * 下载图片并优化
 */
async function downloadAndOptimizeImage(imageUrl) {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': FULL_CONFIG.settings.crawler.userAgent,
      },
    });
    
    // 使用sharp优化图片
    const optimizedBuffer = await sharp(response.data)
      .resize(FULL_CONFIG.settings.imageProcessing.maxWidth, null, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: FULL_CONFIG.settings.imageProcessing.quality,
        progressive: true,
      })
      .toBuffer();
    
    return optimizedBuffer;
  } catch (error) {
    console.error(`❌ 下载图片失败: ${imageUrl}`, error.message);
    return null;
  }
}

/**
 * 上传到Cloudflare R2
 */
async function uploadToR2(buffer, region, materialId, year, period) {
  const key = `materials/${region}/${materialId}/${year}/${period}.jpg`;
  
  try {
    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || 'lottery-materials',
      Key: key,
      Body: buffer,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000', // 缓存1年
    }));
    
    console.log(`✅ 上传成功: ${key}`);
    return true;
  } catch (error) {
    console.error(`❌ 上传失败: ${key}`, error.message);
    return false;
  }
}

/**
 * 爬取单个资料
 */
async function crawlMaterial(material, region, year, period) {
  const { id, name, source, type, enabled } = material;
  
  if (!enabled) {
    console.log(`⏭️ 跳过禁用资料: ${name}`);
    return { success: false, skipped: true };
  }
  
  // 检查是否已存在
  const exists = await checkIfExists(region, id, year, period);
  if (exists) {
    console.log(`ℹ️ 已存在，跳过: ${name} (${period}期)`);
    return { success: true, cached: true };
  }
  
  console.log(`🕷️ 开始爬取: ${name} - ${period}期`);
  
  try {
    // 如果没有配置source，跳过
    if (!source || !source.url) {
      console.log(`⚠️ 未配置数据源: ${name}`);
      return { success: false, reason: 'no_source' };
    }
    
    // 获取页面内容
    const response = await axios.get(source.url, {
      timeout: FULL_CONFIG.settings.crawler.timeout,
      headers: {
        'User-Agent': FULL_CONFIG.settings.crawler.userAgent,
      },
    });
    
    const $ = cheerio.load(response.data);
    
    // 根据类型提取数据
    if (type === 'image' || type === 'mixed') {
      // 提取图片URL（这里需要根据实际网站结构调整选择器）
      const imageUrl = $('.material-image img').first().attr('src') || 
                      $('img.main-image').first().attr('src') ||
                      $('img[alt*="' + name + '"]').first().attr('src');
      
      if (!imageUrl) {
        console.log(`⚠️ 未找到图片: ${name}`);
        return { success: false, reason: 'no_image' };
      }
      
      // 下载并优化图片
      const imageBuffer = await downloadAndOptimizeImage(imageUrl);
      if (!imageBuffer) {
        return { success: false, reason: 'download_failed' };
      }
      
      // 上传到R2
      const uploaded = await uploadToR2(imageBuffer, region, id, year, period);
      return { success: uploaded };
    }
    
    // 其他类型（numbers, chart等）的处理逻辑...
    console.log(`ℹ️ 类型 ${type} 暂未实现`);
    return { success: false, reason: 'type_not_implemented' };
    
  } catch (error) {
    console.error(`❌ 爬取失败: ${name}`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 批量爬取资料（带限流）
 */
async function crawlBatch(materials, region, year, period, priority) {
  console.log(`\n🎯 开始爬取优先级 ${priority} 的资料...`);
  
  const targetMaterials = materials.filter(m => m.priority === priority);
  console.log(`📋 共 ${targetMaterials.length} 个资料`);
  
  const results = [];
  const concurrentLimit = FULL_CONFIG.settings.crawler.concurrentRequests;
  
  // 分批处理，避免并发过高
  for (let i = 0; i < targetMaterials.length; i += concurrentLimit) {
    const batch = targetMaterials.slice(i, i + concurrentLimit);
    
    console.log(`\n📦 处理批次 ${Math.floor(i / concurrentLimit) + 1}/${Math.ceil(targetMaterials.length / concurrentLimit)}`);
    
    const batchPromises = batch.map(material => 
      crawlMaterial(material, region, year, period)
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // 批次间延迟，避免过载
    if (i + concurrentLimit < targetMaterials.length) {
      await delay(FULL_CONFIG.settings.crawler.delayBetweenRequests);
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  const cachedCount = results.filter(r => r.cached).length;
  
  console.log(`✅ 优先级 ${priority} 完成: ${successCount}/${targetMaterials.length} 成功, ${cachedCount} 已缓存`);
  
  return results;
}

/**
 * 主函数：爬取指定区域的所有资料
 */
async function crawlRegion(region) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎰 开始爬取 ${region.toUpperCase()} 资料`);
  console.log(`${'='.repeat(60)}\n`);
  
  // 获取当前期数
  const { year, period } = await getCurrentPeriod(region);
  console.log(`📅 当前: ${year}年 第${period}期`);
  
  // 获取资料列表
  const materials = FULL_CONFIG.materials[region] || [];
  if (materials.length === 0) {
    console.log(`⚠️ 未找到 ${region} 的资料配置`);
    return;
  }
  
  console.log(`📊 共 ${materials.length} 种资料待更新`);
  
  // 按优先级分组
  const priorityGroups = {};
  materials.forEach(m => {
    const p = m.priority || 999;
    if (!priorityGroups[p]) priorityGroups[p] = [];
    priorityGroups[p].push(m);
  });
  
  const priorities = Object.keys(priorityGroups).map(Number).sort((a, b) => a - b);
  console.log(`🎯 优先级分组: ${priorities.join(', ')}`);
  
  // 按优先级依次爬取
  const allResults = [];
  for (const priority of priorities) {
    const results = await crawlBatch(materials, region, year, period, priority);
    allResults.push(...results);
    
    // 优先级间延迟
    await delay(3000);
  }
  
  // 统计结果
  const total = allResults.length;
  const success = allResults.filter(r => r.success).length;
  const cached = allResults.filter(r => r.cached).length;
  const failed = total - success;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 ${region.toUpperCase()} 爬取完成`);
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ 成功: ${success}`);
  console.log(`💾 已缓存: ${cached}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`📊 总计: ${total}`);
  console.log(`${'='.repeat(60)}\n`);
  
  return { total, success, cached, failed };
}

/**
 * 入口函数
 */
async function main() {
  console.log(`\n${'🎰'.repeat(30)}`);
  console.log(`🤖 六合彩资料自动更新系统`);
  console.log(`⏰ 启动时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  console.log(`${'🎰'.repeat(30)}\n`);
  
  // 加载配置
  await loadConfig();
  
  // 检查环境变量
  const requiredEnvVars = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
  ];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`❌ 缺少环境变量: ${envVar}`);
      process.exit(1);
    }
  }
  
  // 确定要更新的区域
  const region = process.env.REGION || 'all';
  const regions = region === 'all' ? ['macao', 'hongkong'] : [region];
  
  console.log(`🎯 更新区域: ${regions.join(', ').toUpperCase()}`);
  
  // 依次爬取各区域
  const results = {};
  for (const r of regions) {
    const regionConfig = FULL_CONFIG.regions[r];
    if (!regionConfig || !regionConfig.enabled) {
      console.log(`⏭️ 跳过未启用的区域: ${r}`);
      continue;
    }
    
    results[r] = await crawlRegion(r);
    
    // 区域间延迟
    if (regions.indexOf(r) < regions.length - 1) {
      console.log(`⏸️ 等待5秒后继续下一个区域...`);
      await delay(5000);
    }
  }
  
  // 总结
  console.log(`\n${'🎉'.repeat(30)}`);
  console.log(`🎉 全部更新完成！`);
  console.log(`⏰ 完成时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  console.log(`${'🎉'.repeat(30)}\n`);
  
  // 输出各区域统计
  for (const [region, result] of Object.entries(results)) {
    console.log(`${region.toUpperCase()}: ✅${result.success} ❌${result.failed} 💾${result.cached}`);
  }
  
  console.log('\n✨ 下次更新时间: 见GitHub Actions配置');
}

// 运行
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 程序异常退出:', error);
    process.exit(1);
  });
}

module.exports = { main, crawlRegion, crawlMaterial };