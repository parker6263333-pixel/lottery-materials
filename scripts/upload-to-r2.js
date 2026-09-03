#!/usr/bin/env node

/**
 * 批量上传现有图片到 R2
 * 
 * 使用场景：
 * 1. 初次部署，将本地已有图片批量上传
 * 2. 迁移数据
 */

require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

// R2 客户端
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * 扫描本地图片文件
 */
async function scanLocalImages(baseDir) {
  console.log(`🔍 扫描本地图片: ${baseDir}`);
  
  const images = [];
  
  async function scan(dir, region = 'macao') {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // 检测region
          if (entry.name === 'macao' || entry.name === 'taiwan') {
            await scan(fullPath, entry.name);
          } else {
            await scan(fullPath, region);
          }
        } else if (entry.isFile() && /\.(jpg|jpeg|png)$/i.test(entry.name)) {
          // 解析路径: materials/{region}/{type}/{year}/{period}.jpg
          const relativePath = path.relative(baseDir, fullPath);
          const parts = relativePath.split(path.sep);
          
          if (parts.length >= 4) {
            const materialType = parts[parts.length - 3];
            const year = parts[parts.length - 2];
            const period = path.parse(parts[parts.length - 1]).name;
            
            images.push({
              localPath: fullPath,
              region,
              materialType,
              year,
              period,
              r2Key: `materials/${region}/${materialType}/${year}/${period}.jpg`,
            });
          }
        }
      }
    } catch (error) {
      console.error(`扫描目录失败 ${dir}: ${error.message}`);
    }
  }
  
  await scan(baseDir);
  
  console.log(`✅ 找到 ${images.length} 张图片`);
  return images;
}

/**
 * 上传单张图片
 */
async function uploadImage(image) {
  try {
    // 读取文件
    const buffer = await fs.readFile(image.localPath);
    
    // 压缩优化
    const optimized = await sharp(buffer)
      .resize(800, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .jpeg({
        quality: 85,
        progressive: true,
        mozjpeg: true,
      })
      .toBuffer();
    
    // 上传到R2
    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: image.r2Key,
      Body: optimized,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    
    const originalSize = (buffer.length / 1024).toFixed(2);
    const optimizedSize = (optimized.length / 1024).toFixed(2);
    const savedPercent = ((1 - optimized.length / buffer.length) * 100).toFixed(1);
    
    console.log(`✅ ${image.r2Key} (${originalSize}KB → ${optimizedSize}KB, 节省${savedPercent}%)`);
    
    return { success: true, ...image, fileSize: optimized.length };
  } catch (error) {
    console.error(`❌ ${image.r2Key}: ${error.message}`);
    return { success: false, ...image, error: error.message };
  }
}

/**
 * 批量上传
 */
async function batchUpload(images, concurrency = 3) {
  console.log(`\n🚀 开始批量上传 (并发: ${concurrency})`);
  
  const results = [];
  const chunks = [];
  
  // 分批
  for (let i = 0; i < images.length; i += concurrency) {
    chunks.push(images.slice(i, i + concurrency));
  }
  
  // 逐批上传
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`\n📦 批次 ${i + 1}/${chunks.length} (${chunk.length} 张)`);
    
    const batchResults = await Promise.all(chunk.map(uploadImage));
    results.push(...batchResults);
    
    // 显示进度
    const uploaded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`进度: ${uploaded + failed}/${images.length} (成功: ${uploaded}, 失败: ${failed})`);
  }
  
  return results;
}

/**
 * 生成SQL插入语句
 */
function generateSQL(results) {
  console.log(`\n📝 生成数据库插入语句`);
  
  const successResults = results.filter(r => r.success);
  
  if (successResults.length === 0) {
    console.log(`⚠️  没有成功上传的图片`);
    return;
  }
  
  const macaoSQL = [];
  const taiwanSQL = [];
  
  for (const result of successResults) {
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${result.r2Key}`;
    const date = new Date().toISOString().split('T')[0];
    
    const sql = `
INSERT OR IGNORE INTO ${result.region}_materials (material_type, period, year, image_url, file_size, date)
VALUES ('${result.materialType}', '${result.period}', ${result.year}, '${publicUrl}', ${result.fileSize}, '${date}');`.trim();
    
    if (result.region === 'macao') {
      macaoSQL.push(sql);
    } else {
      taiwanSQL.push(sql);
    }
  }
  
  // 输出到文件
  const sqlContent = `-- 港澳六合彩资料\n${macaoSQL.join('\n\n')}\n\n-- 台湾六合彩资料\n${taiwanSQL.join('\n\n')}`;
  
  fs.writeFile('migrations/import-data.sql', sqlContent);
  
  console.log(`✅ SQL语句已保存到: migrations/import-data.sql`);
  console.log(`\n执行以下命令导入数据库:`);
  console.log(`wrangler d1 execute lhc-metadata --file=migrations/import-data.sql --remote`);
}

/**
 * 主函数
 */
async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📤 批量上传工具`);
  console.log(`${'='.repeat(60)}\n`);
  
  // 检查配置
  if (!process.env.R2_ACCESS_KEY_ID) {
    console.error(`❌ 错误: 缺少R2配置，请检查.env文件`);
    process.exit(1);
  }
  
  // 扫描本地图片
  const baseDir = path.join(__dirname, '..', 'assets', 'images', 'materials');
  const images = await scanLocalImages(baseDir);
  
  if (images.length === 0) {
    console.log(`⚠️  没有找到图片，退出`);
    return;
  }
  
  // 确认上传
  console.log(`\n📊 统计:`);
  const stats = {};
  images.forEach(img => {
    const key = `${img.region}-${img.materialType}`;
    stats[key] = (stats[key] || 0) + 1;
  });
  
  Object.entries(stats).forEach(([key, count]) => {
    console.log(`  ${key}: ${count} 张`);
  });
  
  console.log(`\n⚠️  即将上传 ${images.length} 张图片到 Cloudflare R2`);
  console.log(`⏱️  预计耗时: ${Math.ceil(images.length / 3)} 分钟`);
  console.log(`\n按 Ctrl+C 取消，或按回车继续...`);
  
  // 等待用户确认（在实际使用中取消注释）
  // await new Promise(resolve => process.stdin.once('data', resolve));
  
  // 批量上传
  const results = await batchUpload(images, 3);
  
  // 生成SQL
  generateSQL(results);
  
  // 统计
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 上传统计`);
  console.log(`${'='.repeat(60)}`);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalSize = results
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.fileSize, 0);
  
  console.log(`✅ 成功: ${successful} 张`);
  console.log(`❌ 失败: ${failed} 张`);
  console.log(`💾 总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  
  if (failed > 0) {
    console.log(`\n失败列表:`);
    results
      .filter(r => !r.success)
      .forEach(r => console.log(`  • ${r.r2Key}: ${r.error}`));
  }
  
  console.log(`\n🎉 批量上传完成！`);
}

// 执行
if (require.main === module) {
  main().catch(error => {
    console.error(`\n💥 致命错误: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = { scanLocalImages, uploadImage, batchUpload };
