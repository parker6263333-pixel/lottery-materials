/**
 * Cloudflare R2 清理和重新配置脚本
 * 用途：清除旧数据，设置新的目录结构
 */

const { S3Client, ListObjectsV2Command, DeleteObjectsCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

// 从环境变量读取配置
const R2_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'liuhecai-materials';

// 配置 S3 客户端（R2 兼容 S3 API）
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * 列出所有对象
 */
async function listAllObjects(prefix = '') {
  const objects = [];
  let continuationToken = undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const response = await r2Client.send(command);
    
    if (response.Contents) {
      objects.push(...response.Contents);
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

/**
 * 批量删除对象
 */
async function deleteObjects(keys) {
  if (keys.length === 0) return;

  // S3/R2 每次最多删除1000个对象
  const batchSize = 1000;
  
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    
    const command = new DeleteObjectsCommand({
      Bucket: R2_BUCKET_NAME,
      Delete: {
        Objects: batch.map(key => ({ Key: key })),
      },
    });

    await r2Client.send(command);
    console.log(`✅ 已删除 ${batch.length} 个对象 (${i + batch.length}/${keys.length})`);
  }
}

/**
 * 创建目录结构标记文件
 */
async function createDirectoryStructure() {
  const directories = [
    'hongkong/images/',
    'hongkong/data/',
    'macao/images/',
    'macao/data/',
    'taiwan/images/',      // 台湾预留
    'taiwan/data/',        // 台湾预留
    'temp/',
    'backups/',
  ];

  for (const dir of directories) {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: `${dir}.placeholder`,
      Body: `# ${dir}\n创建时间: ${new Date().toISOString()}`,
      ContentType: 'text/plain',
    });

    await r2Client.send(command);
    console.log(`✅ 创建目录: ${dir}`);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始清理 R2 存储桶...\n');
  console.log(`📦 存储桶: ${R2_BUCKET_NAME}`);
  console.log(`🏢 账号ID: ${R2_ACCOUNT_ID}\n`);

  try {
    // 1. 列出所有对象
    console.log('📋 正在列出所有对象...');
    const objects = await listAllObjects();
    console.log(`📊 找到 ${objects.length} 个对象\n`);

    if (objects.length > 0) {
      // 2. 删除所有对象
      console.log('🗑️  正在删除旧数据...');
      const keys = objects.map(obj => obj.Key);
      await deleteObjects(keys);
      console.log(`✅ 已删除所有旧数据 (${objects.length} 个对象)\n`);
    } else {
      console.log('ℹ️  存储桶为空，无需删除\n');
    }

    // 3. 创建新的目录结构
    console.log('📁 正在创建新的目录结构...');
    await createDirectoryStructure();
    console.log('\n✅ 目录结构创建完成！');

    // 4. 显示新结构
    console.log('\n📂 新的目录结构：');
    console.log('├── hongkong/');
    console.log('│   ├── images/     (香港资料图片)');
    console.log('│   └── data/       (香港文本数据)');
    console.log('├── macao/');
    console.log('│   ├── images/     (澳门资料图片)');
    console.log('│   └── data/       (澳门文本数据)');
    console.log('├── taiwan/         (台湾预留)');
    console.log('│   ├── images/     ⏸️ 预留');
    console.log('│   └── data/       ⏸️ 预留');
    console.log('├── temp/           (临时文件)');
    console.log('└── backups/        (备份文件)');

    console.log('\n🎉 R2 存储桶清理和配置完成！');
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

// 运行
main();
