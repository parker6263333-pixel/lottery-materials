#!/usr/bin/env node

/**
 * R2 存储桶清理和重新配置脚本
 * 功能：
 * 1. 清空旧数据
 * 2. 创建新的文件夹结构
 * 3. 上传测试文件
 */

const { S3Client, ListObjectsV2Command, DeleteObjectsCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

// Cloudflare R2 配置（需要从环境变量获取）
const R2_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'lottery-materials';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * 列出存储桶中的所有对象
 */
async function listAllObjects() {
  console.log('📋 正在列出所有文件...');
  const objects = [];
  let continuationToken;

  do {
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);
    if (response.Contents) {
      objects.push(...response.Contents);
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  console.log(`✅ 找到 ${objects.length} 个文件`);
  return objects;
}

/**
 * 批量删除对象
 */
async function deleteAllObjects(objects) {
  if (objects.length === 0) {
    console.log('✅ 存储桶已经是空的');
    return;
  }

  console.log(`🗑️  正在删除 ${objects.length} 个文件...`);

  // S3/R2 每次最多删除1000个对象
  const batchSize = 1000;
  for (let i = 0; i < objects.length; i += batchSize) {
    const batch = objects.slice(i, i + batchSize);
    
    const command = new DeleteObjectsCommand({
      Bucket: R2_BUCKET_NAME,
      Delete: {
        Objects: batch.map(obj => ({ Key: obj.Key })),
        Quiet: false,
      },
    });

    await s3Client.send(command);
    console.log(`   已删除 ${Math.min(i + batchSize, objects.length)}/${objects.length}`);
  }

  console.log('✅ 所有旧数据已删除');
}

/**
 * 创建新的文件夹结构
 */
async function createFolderStructure() {
  console.log('📁 正在创建新的文件夹结构...');

  const folders = [
    'hongkong/2026/',
    'macao/2026/',
    'taiwan/2026/',  // 预留
    'thumbnails/hongkong/',
    'thumbnails/macao/',
    'thumbnails/taiwan/',
  ];

  // R2 没有真正的"文件夹"，通过上传空对象模拟
  for (const folder of folders) {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: `${folder}.keep`,  // 创建一个占位文件
      Body: Buffer.from('This file keeps the folder structure'),
      ContentType: 'text/plain',
    });

    await s3Client.send(command);
    console.log(`   ✅ 创建文件夹: ${folder}`);
  }

  console.log('✅ 文件夹结构创建完成');
}

/**
 * 上传测试文件
 */
async function uploadTestFile() {
  console.log('📤 正在上传测试文件...');

  const testContent = JSON.stringify({
    message: '测试文件',
    timestamp: new Date().toISOString(),
    status: 'R2 存储桶配置成功',
  }, null, 2);

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: 'test/config-test.json',
    Body: Buffer.from(testContent),
    ContentType: 'application/json',
  });

  await s3Client.send(command);
  console.log('✅ 测试文件上传成功: test/config-test.json');
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始清理和配置 R2 存储桶');
  console.log(`📦 存储桶: ${R2_BUCKET_NAME}`);
  console.log('---\n');

  try {
    // 步骤1: 列出所有文件
    const objects = await listAllObjects();

    // 步骤2: 删除所有旧数据
    if (objects.length > 0) {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise(resolve => {
        readline.question(`⚠️  确定要删除 ${objects.length} 个文件吗？(yes/no): `, resolve);
      });
      readline.close();

      if (answer.toLowerCase() === 'yes') {
        await deleteAllObjects(objects);
      } else {
        console.log('❌ 已取消删除操作');
        process.exit(0);
      }
    }

    // 步骤3: 创建新的文件夹结构
    await createFolderStructure();

    // 步骤4: 上传测试文件
    await uploadTestFile();

    console.log('\n🎉 R2 存储桶清理和配置完成！');
    console.log('\n📊 新的文件夹结构:');
    console.log('   hongkong/2026/     - 香港资料');
    console.log('   macao/2026/        - 澳门资料');
    console.log('   taiwan/2026/       - 台湾预留');
    console.log('   thumbnails/        - 缩略图');

  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

// 检查环境变量
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('❌ 缺少必需的环境变量:');
  console.error('   CLOUDFLARE_ACCOUNT_ID');
  console.error('   R2_ACCESS_KEY_ID');
  console.error('   R2_SECRET_ACCESS_KEY');
  console.error('\n请在 .env 文件中配置这些变量');
  process.exit(1);
}

main();
