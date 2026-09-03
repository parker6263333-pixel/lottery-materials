-- ============================================
-- 🗄️ Cloudflare D1 数据库结构
-- 用于存储六合彩资料元数据和历史记录
-- ============================================

-- 1. 开奖期数表
CREATE TABLE IF NOT EXISTS lottery_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    region TEXT NOT NULL,                    -- 区域: macao, hongkong, taiwan
    year INTEGER NOT NULL,                   -- 年份
    period INTEGER NOT NULL,                 -- 期数
    draw_date DATE NOT NULL,                 -- 开奖日期
    draw_time TIME,                          -- 开奖时间
    winning_numbers TEXT,                    -- 中奖号码（JSON数组）
    special_number INTEGER,                  -- 特别号
    status TEXT DEFAULT 'pending',           -- 状态: pending, drawn, completed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(region, year, period)
);

-- 2. 资料表
CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    region TEXT NOT NULL,                    -- 区域
    material_id TEXT NOT NULL,               -- 资料ID（如：paogoutu）
    material_name TEXT NOT NULL,             -- 资料名称
    category TEXT NOT NULL,                  -- 分类: hot, medium, low, analysis
    type TEXT NOT NULL,                      -- 类型: image, numbers, mixed, chart
    year INTEGER NOT NULL,                   -- 年份
    period INTEGER NOT NULL,                 -- 期数
    file_path TEXT NOT NULL,                 -- R2存储路径
    file_size INTEGER,                       -- 文件大小（字节）
    file_url TEXT,                           -- 公开访问URL
    metadata TEXT,                           -- 额外元数据（JSON）
    priority INTEGER DEFAULT 999,            -- 优先级
    view_count INTEGER DEFAULT 0,            -- 浏览次数
    is_available BOOLEAN DEFAULT 1,          -- 是否可用
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(region, material_id, year, period)
);

-- 3. 爬虫日志表
CREATE TABLE IF NOT EXISTS crawl_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    region TEXT NOT NULL,                    -- 区域
    year INTEGER NOT NULL,                   -- 年份
    period INTEGER NOT NULL,                 -- 期数
    trigger_type TEXT,                       -- 触发类型: after_draw, morning, afternoon, manual
    start_time DATETIME NOT NULL,            -- 开始时间
    end_time DATETIME,                       -- 结束时间
    duration_seconds INTEGER,                -- 耗时（秒）
    total_materials INTEGER,                 -- 总资料数
    success_count INTEGER,                   -- 成功数
    cached_count INTEGER,                    -- 缓存数
    failed_count INTEGER,                    -- 失败数
    status TEXT DEFAULT 'running',           -- 状态: running, success, failed
    error_message TEXT,                      -- 错误信息
    details TEXT,                            -- 详细日志（JSON）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. 台湾资料预留表（暂不启用，预留结构）
CREATE TABLE IF NOT EXISTS taiwan_materials_reserved (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id TEXT NOT NULL,               -- 资料ID
    material_name TEXT NOT NULL,             -- 资料名称
    category TEXT NOT NULL,                  -- 分类
    type TEXT NOT NULL,                      -- 类型
    year INTEGER NOT NULL,                   -- 年份
    period INTEGER NOT NULL,                 -- 期数
    file_path TEXT,                          -- R2存储路径（预留）
    source_type TEXT DEFAULT 'manual',       -- 来源类型: manual, ai_generated, crawled
    is_ready BOOLEAN DEFAULT 0,              -- 是否就绪
    notes TEXT,                              -- 备注
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(material_id, year, period)
);

-- ============================================
-- 索引优化
-- ============================================

-- lottery_periods 索引
CREATE INDEX IF NOT EXISTS idx_periods_region_year_period 
    ON lottery_periods(region, year, period);
CREATE INDEX IF NOT EXISTS idx_periods_draw_date 
    ON lottery_periods(draw_date);
CREATE INDEX IF NOT EXISTS idx_periods_status 
    ON lottery_periods(status);

-- materials 索引
CREATE INDEX IF NOT EXISTS idx_materials_region_material_id 
    ON materials(region, material_id);
CREATE INDEX IF NOT EXISTS idx_materials_year_period 
    ON materials(year, period);
CREATE INDEX IF NOT EXISTS idx_materials_category 
    ON materials(category);
CREATE INDEX IF NOT EXISTS idx_materials_priority 
    ON materials(priority);
CREATE INDEX IF NOT EXISTS idx_materials_view_count 
    ON materials(view_count DESC);

-- crawl_logs 索引
CREATE INDEX IF NOT EXISTS idx_crawl_logs_region_date 
    ON crawl_logs(region, start_time);
CREATE INDEX IF NOT EXISTS idx_crawl_logs_status 
    ON crawl_logs(status);

-- ============================================
-- 视图：最新资料
-- ============================================

CREATE VIEW IF NOT EXISTS v_latest_materials AS
SELECT 
    m.*,
    p.draw_date,
    p.winning_numbers
FROM materials m
LEFT JOIN lottery_periods p 
    ON m.region = p.region 
    AND m.year = p.year 
    AND m.period = p.period
WHERE m.is_available = 1
ORDER BY m.year DESC, m.period DESC, m.priority ASC;

-- ============================================
-- 视图：热门资料统计
-- ============================================

CREATE VIEW IF NOT EXISTS v_hot_materials AS
SELECT 
    region,
    material_id,
    material_name,
    category,
    COUNT(*) as period_count,
    SUM(view_count) as total_views,
    MAX(updated_at) as last_update
FROM materials
WHERE is_available = 1
GROUP BY region, material_id, material_name, category
ORDER BY total_views DESC;

-- ============================================
-- 视图：爬虫统计
-- ============================================

CREATE VIEW IF NOT EXISTS v_crawl_stats AS
SELECT 
    region,
    DATE(start_time) as crawl_date,
    trigger_type,
    COUNT(*) as crawl_times,
    AVG(duration_seconds) as avg_duration,
    SUM(success_count) as total_success,
    SUM(failed_count) as total_failed,
    ROUND(AVG(CAST(success_count AS FLOAT) / NULLIF(total_materials, 0) * 100), 2) as success_rate
FROM crawl_logs
WHERE status = 'success'
GROUP BY region, DATE(start_time), trigger_type
ORDER BY crawl_date DESC;

-- ============================================
-- 初始化数据（示例）
-- ============================================

-- 插入2026年期数（澳门每天一期，365期）
-- 注意：实际使用时由爬虫自动创建

-- 插入配置记录（用于标记数据库版本）
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO system_config (key, value, description) VALUES 
    ('db_version', '1.0.0', '数据库版本'),
    ('init_date', datetime('now'), '初始化日期'),
    ('regions_enabled', '["macao","hongkong"]', '启用的区域'),
    ('taiwan_reserved', 'true', '台湾资料已预留');

-- ============================================
-- 完成
-- ============================================
-- 
-- 使用方法：
-- 1. 创建Cloudflare D1数据库：wrangler d1 create lottery-db
-- 2. 运行此SQL：wrangler d1 execute lottery-db --file=schema.sql
-- 3. 将数据库ID填入wrangler.toml和GitHub Secrets
-- 
-- ============================================