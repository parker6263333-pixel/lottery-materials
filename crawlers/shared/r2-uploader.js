const axios = require('axios');
const cheerio = require('cheerio');
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

// R2 客户端配置
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// 上传图片到 R2
async function uploadImageToR2(imageUrl, key) {
  try {
    console.log(`  📥 下载图片: ${imageUrl}`);
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    
    console.log(`  ☁️  上传到 R2: ${key}`);
    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: Buffer.from(response.data),
      ContentType: contentType,
    }));

    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    console.log(`  ✅ 上传成功: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error(`  ❌ 上传失败: ${error.message}`);
    return null;
  }
}

// 生成唯一的文件名
function generateFileName(materialType, ext = 'jpg') {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `${materialType}-${timestamp}-${random}.${ext}`;
}

module.exports = {
  r2Client,
  uploadImageToR2,
  generateFileName,
};
