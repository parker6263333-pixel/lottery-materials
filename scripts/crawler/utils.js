/**
 * 爬虫工具函数
 */

const crypto = require('crypto');

/**
 * 生成唯一ID
 */
function generateId(prefix = '') {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `${prefix}${timestamp}-${random}`;
}

/**
 * 格式化期数（补零）
 */
function formatPeriod(period, length = 3) {
    return String(period).padStart(length, '0');
}

/**
 * 获取当前年份和期数
 */
function getCurrentPeriod() {
    const now = new Date();
    const year = now.getFullYear();
    
    // 港澳彩一年约156期（每周二、周四、周六）
    // 计算当前是第几期
    const startOfYear = new Date(year, 0, 1);
    const dayOfYear = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
    const period = Math.floor(dayOfYear / 2.34); // 约2.34天一期
    
    return { year, period };
}

/**
 * 延迟执行
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 重试函数
 */
async function retry(fn, times = 3, delay = 1000) {
    let lastError;
    
    for (let i = 0; i < times; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (i < times - 1) {
                console.log(`⚠️  重试 ${i + 1}/${times}...`);
                await sleep(delay * (i + 1)); // 递增延迟
            }
        }
    }
    
    throw lastError;
}

/**
 * 格式化文件大小
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 验证URL
 */
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * 清理文件名
 */
function sanitizeFilename(filename) {
    return filename
        .replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, '_')
        .replace(/_{2,}/g, '_')
        .toLowerCase();
}

/**
 * 解析期数信息
 */
function parsePeriodInfo(text) {
    // 匹配格式: "2026年第001期" 或 "2026-001"
    const patterns = [
        /(\d{4})年第(\d{3})期/,
        /(\d{4})-(\d{3})/,
        /(\d{4})\/(\d{3})/
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return {
                year: parseInt(match[1]),
                period: parseInt(match[2])
            };
        }
    }
    
    return null;
}

/**
 * 生成日期范围
 */
function getDateRange(startYear, startPeriod, endYear, endPeriod) {
    const ranges = [];
    
    for (let year = startYear; year <= endYear; year++) {
        const minPeriod = year === startYear ? startPeriod : 1;
        const maxPeriod = year === endYear ? endPeriod : 156;
        
        for (let period = minPeriod; period <= maxPeriod; period++) {
            ranges.push({ year, period });
        }
    }
    
    return ranges;
}

/**
 * 计算预计完成时间
 */
function estimateCompletionTime(totalItems, itemsPerMinute = 10) {
    const minutes = Math.ceil(totalItems / itemsPerMinute);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
        return `约${hours}小时${mins}分钟`;
    }
    return `约${mins}分钟`;
}

/**
 * 进度条
 */
function progressBar(current, total, barLength = 40) {
    const percentage = (current / total * 100).toFixed(1);
    const filledLength = Math.floor(barLength * current / total);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    return `[${bar}] ${percentage}% (${current}/${total})`;
}

/**
 * 日志颜色（Windows PowerShell兼容）
 */
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function colorize(text, color) {
    return `${colors[color] || ''}${text}${colors.reset}`;
}

/**
 * 格式化时间戳
 */
function formatTimestamp(date = new Date()) {
    return date.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * 验证环境变量
 */
function validateEnv() {
    const required = [
        'R2_ACCESS_KEY_ID',
        'R2_SECRET_ACCESS_KEY',
        'R2_ENDPOINT',
        'R2_BUCKET_NAME',
        'R2_PUBLIC_URL'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        throw new Error(`缺少必需的环境变量: ${missing.join(', ')}`);
    }
}

module.exports = {
    generateId,
    formatPeriod,
    getCurrentPeriod,
    sleep,
    retry,
    formatBytes,
    isValidUrl,
    sanitizeFilename,
    parsePeriodInfo,
    getDateRange,
    estimateCompletionTime,
    progressBar,
    colorize,
    colors,
    formatTimestamp,
    validateEnv
};
