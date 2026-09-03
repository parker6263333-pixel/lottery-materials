/**
 * Cloudflare D1 数据库管理器
 * 用于存储资料元数据和开奖记录
 */

const axios = require('axios');
require('dotenv').config();

class D1Manager {
  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    this.databaseId = process.env.D1_DATABASE_ID;
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}`;
  }

  async query(sql, params = []) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/query`,
        { sql, params },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data.result;
    } catch (error) {
      console.error('D1 query error:', error.response?.data || error.message);
      throw error;
    }
  }

  // 保存资料记录
  async saveMaterial(data) {
    const sql = `
      INSERT INTO materials (period, lottery_type, material_type, image_url, content, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(period, lottery_type, material_type) 
      DO UPDATE SET image_url=excluded.image_url, content=excluded.content, updated_at=datetime('now')
    `;
    return this.query(sql, [
      data.period,
      data.lotteryType,
      data.materialType,
      data.imageUrl,
      JSON.stringify(data.content)
    ]);
  }

  // 获取最新期数
  async getLatestPeriod(lotteryType) {
    const sql = `SELECT MAX(period) as latest FROM materials WHERE lottery_type = ?`;
    const result = await this.query(sql, [lotteryType]);
    return result[0]?.latest || null;
  }
}

module.exports = D1Manager;
