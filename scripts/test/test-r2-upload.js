/**
 * R2 存储桶上传测试脚本
 * 用途：验证 R2 配置是否正确，上传测试图片
 */

require('dotenv').config();
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// 配置验证
function validateConfig() {
  const required = [
    'CLOUDFLARE_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ 缺少必要的环境变量：', missing.join(', '));
    process.exit(1);
  }
  
  console.log('✅ 环境变量配置验证通过！');
  console.log('📦 存储桶名称：', process.env.R2_BUCKET_NAME);
  console.log('🔑 账号ID：', process.env.CLOUDFLARE_ACCOUNT_ID);
}

// 初始化 S3 客户端（R2 兼容 S3 API）
function createR2Client() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

// 创建测试图片（简单的 SVG）
function createTestImage() {
  const testDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const testImagePath = path.join(testDir, 'test-image.svg');
  
  const svgContent = `
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="300" fill="#4a90e2"/>
  <text x="200" y="150" font-size="24" fill="white" text-anchor="middle">
    R2 上传测试成功 ✓
  </text>
  <text x="200" y="180" font-size="14" fill="white" text-anchor="middle">
    ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong' })}
  </text>
</svg>
  `.trim();
  
  fs.writeFileSync(testImagePath, svgContent);
  console.log('✅ 测试图片已创建：', testImagePath);
  
  return testImagePath;
}

// 上传测试图片
async function uploadTestImage(client, testImagePath) {
  const bucketName = process.env.R2_BUCKET_NAME;
  const fileContent = fs.readFileSync(testImagePath);
  const fileName = 'test/test-upload-' + Date.now() + '.svg';
  
  console.log('\n📤 开始上传测试图片...');
  console.log('📁 目标路径：', fileName);
  
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: fileContent,
      ContentType: 'image/svg+xml',
      Metadata: {
        'upload-time': new Date().toISOString(),
        'test-version': '1.0'
      }
    });
    
    await client.send(command);
    
    console.log('✅ 上传成功！');
    console.log('📍 文件路径：', `${bucketName}/${fileName}`);
    
    return fileName;
  } catch (error) {
    console.error('❌ 上传失败：', error.message);
    throw error;
  }
}

// 列出存储桶内容
async function listBucketContents(client) {
  const bucketName = process.env.R2_BUCKET_NAME;
  
  console.log('\n📋 列出存储桶内容...');
  
  try {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 10
    });
    
    const response = await client.send(command);
    
    if (!response.Contents || response.Contents.length === 0) {
      console.log('📦 存储桶为空（这是正常的，刚刚创建）');
      return;
    }
    
    console.log(`✅ 找到 ${response.Contents.length} 个文件：\n`);
    
    response.Contents.forEach((item, index) => {
      const sizeKB = (item.Size / 1024).toFixed(2);
      console.log(`${index + 1}. ${item.Key}`);
      console.log(`   大小：${sizeKB} KB`);
      console.log(`   最后修改：${item.LastModified.toLocaleString('zh-CN')}\n`);
    });
    
  } catch (error) {
    console.error('❌ 列出文件失败：', error.message);
    throw error;
  }
}

// 主函数
async function main() {
  console.log('🚀 开始测试 R2 存储桶配置...\n');
  
  try {
    // 1. 验证配置
    validateConfig();
    
    // 2. 创建客户端
    console.log('\n🔧 初始化 R2 客户端...');
    const client = createR2Client();
    console.log('✅ R2 客户端初始化成功！');
    
    // 3. 创建测试图片
    console.log('\n🎨 创建测试图片...');
    const testImagePath = createTestImage();
    
    // 4. 上传测试图片
    const uploadedFile = await uploadTestImage(client, testImagePath);
    
    // 5. 列出存储桶内容
    await listBucketContents(client);
    
    // 6. 清理临时文件
    console.log('🧹 清理临时文件...');
    fs.unlinkSync(testImagePath);
    console.log('✅ 清理完成！');
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 测试完成！R2 存储桶配置正确！');
    console.log('='.repeat(50));
    console.log('\n✅ 接下来可以：');
    console.log('1. 配置 R2 公共访问 URL');
    console.log('2. 创建 D1 数据库');
    console.log('3. 运行正式爬虫脚本');
    
  } catch (error) {
    console.error('\n' + '='.repeat(50));
    console.error('❌ 测试失败！');
    console.error('='.repeat(50));
    console.error('\n错误信息：', error.message);
    console.error('\n请检查：');
    console.error('1. .env 文件配置是否正确');
    console.error('2. API 密钥是否有效');
    console.error('3. 存储桶名称是否正确');
    console.error('4. 网络连接是否正常');
    process.exit(1);
  }
}

// 运行测试
main();
