/**
 * Cloudflare R2 图片上传器
 * 用于上传资料图片到 Cloudflare R2 存储
 */

const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const axios = require('axios');
const sharp = require('sharp');
const path = require('path');
const crypto = require('crypto');

class R2Uploader {
  constructor(config) {
    this.config = config;
    this.client = new S3Client({
      region: 'auto',
      endpoint: config.R2_ENDPOINT,
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY
      }
    });
    this.bucketName = config.R2_BUCKET_NAME;
    this.publicUrl = config.R2_PUBLIC_URL;
  }

  /**
   * 生成文件哈希（用于去重）
   */
  generateHash(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  /**
   * 检查文件是否已存在
   */
  async fileExists(key) {
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key
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
   * 上传图片到 R2
   */
