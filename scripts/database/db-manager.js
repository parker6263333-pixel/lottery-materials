/**
 * 数据库管理工具
 * 用于初始化和更新D1数据库
 */

const https = require('https');
require('dotenv').config();

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const D1_DATABASE_ID = process.env.D1_DATABASE_ID;

class DatabaseManager {
    constructor() {
        this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}`;
    }

    /**
     * 执行SQL查询
     */
    async query(sql, params = []) {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({
                sql: sql,
                params: params
            });

            const options = {
                hostname: 'api.cloudflare.com',
                path: `/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseData);
                        if (parsed.success) {
                            resolve(parsed.result);
                        } else {
                            reject(new Error(parsed.errors[0]?.message || 'Query failed'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }

    /**
     * 插入或更新资料记录
     */
    async upsertMaterial(data) {
        const sql = `
            INSERT INTO periods (
                material_id, period, year, draw_date,
                image_url, image_path, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(material_id, year, period) 
            DO UPDATE SET
                image_url = excluded.image_url,
                image_path = excluded.image_path,
                updated_at = CURRENT_TIMESTAMP
        `;

        const params = [
            data.material_id,
            data.period,
            data.year,
            data.draw_date,
            data.image_url,
            data.image_path,
            'active'
        ];

        try {
            await this.query(sql, params);
            console.log(`✅ 数据库更新: ${data.material_id} ${data.year}/${data.period}`);
            return true;
        } catch (error) {
            console.error(`❌ 数据库更新失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 批量插入
     */
    async batchUpsert(records) {
        console.log(`\n📊 批量更新数据库: ${records.length} 条记录`);
        
        let successCount = 0;
        for (const record of records) {
            const success = await this.upsertMaterial(record);
            if (success) successCount++;
            
            // 避免请求过快
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`✅ 数据库更新完成: ${successCount}/${records.length}\n`);
        return successCount;
    }

    /**
     * 获取最新期数
     */
    async getLatestPeriod(materialId, year) {
        const sql = `
            SELECT period
            FROM periods
            WHERE material_id = ? AND year = ?
            ORDER BY period DESC
            LIMIT 1
        `;

        try {
            const result = await this.query(sql, [materialId, year]);
            return result[0]?.results[0]?.period || 0;
        } catch (error) {
            console.error('获取最新期数失败:', error.message);
            return 0;
        }
    }

    /**
     * 检查期数是否存在
     */
    async periodExists(materialId, year, period) {
        const sql = `
            SELECT COUNT(*) as count
            FROM periods
            WHERE material_id = ? AND year = ? AND period = ?
        `;

        try {
            const result = await this.query(sql, [materialId, year, period]);
            return result[0]?.results[0]?.count > 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * 记录更新日志
     */
    async logUpdate(materialId, action, period, message, errorDetails = null) {
        const sql = `
            INSERT INTO update_logs (material_id, action, period, message, error_details)
            VALUES (?, ?, ?, ?, ?)
        `;

        try {
            await this.query(sql, [materialId, action, period, message, errorDetails]);
        } catch (error) {
            console.error('记录日志失败:', error.message);
        }
    }

    /**
     * 获取统计信息
     */
    async getStats() {
        const sql = `
            SELECT 
                material_id,
                COUNT(*) as total_periods,
                MAX(year) as latest_year,
                MAX(period) as latest_period,
                MAX(updated_at) as last_update
            FROM periods
            GROUP BY material_id
            ORDER BY material_id
        `;

        try {
            const result = await this.query(sql);
            return result[0]?.results || [];
        } catch (error) {
            console.error('获取统计失败:', error.message);
            return [];
        }
    }

    /**
     * 清理旧数据（保留最近3年）
     */
    async cleanOldData(keepYears = 3) {
        const currentYear = new Date().getFullYear();
        const cutoffYear = currentYear - keepYears;

        const sql = `
            UPDATE periods
            SET status = 'archived'
            WHERE year < ? AND status = 'active'
        `;

        try {
            const result = await this.query(sql, [cutoffYear]);
            console.log(`🗑️  归档旧数据: ${cutoffYear}年之前的记录`);
            return result;
        } catch (error) {
            console.error('清理数据失败:', error.message);
            return null;
        }
    }
}

// 辅助函数：将上传结果转换为数据库记录
function uploadResultToDbRecord(uploadResult) {
    return {
        material_id: uploadResult.materialId,
        period: uploadResult.period,
        year: uploadResult.year,
        draw_date: uploadResult.drawDate || new Date().toISOString().split('T')[0],
        image_url: uploadResult.url,
        image_path: uploadResult.path,
        status: 'active'
    };
}

// 命令行工具
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    const db = new DatabaseManager();

    try {
        switch (command) {
            case 'stats':
                // 显示统计信息
                const stats = await db.getStats();
                console.log('\n📊 资料库统计:\n');
                console.table(stats);
                break;

            case 'check':
                // 检查某期是否存在
                const [, materialId, year, period] = args;
                const exists = await db.periodExists(materialId, parseInt(year), parseInt(period));
                console.log(`期数 ${materialId} ${year}/${period}: ${exists ? '✅ 已存在' : '❌ 不存在'}`);
                break;

            case 'clean':
                // 清理旧数据
                await db.cleanOldData(3);
                console.log('✅ 清理完成');
                break;

            default:
                console.log('用法:');
                console.log('  node db-manager.js stats                    # 查看统计');
                console.log('  node db-manager.js check <material> <year> <period>  # 检查期数');
                console.log('  node db-manager.js clean                    # 清理旧数据');
        }
    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { DatabaseManager, uploadResultToDbRecord };
