-- 完整资料库数据库架构
-- 支持香港、澳门、台湾三种彩种
-- 支持100+种资料类型

-- 主开奖结果表
CREATE TABLE IF NOT EXISTS lottery_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lottery_type TEXT NOT NULL, -- 'hongkong', 'macao', 'taiwan'
  period INTEGER NOT NULL,
  year INTEGER NOT NULL,
  draw_date TEXT NOT NULL,
  draw_time TEXT,
  numbers TEXT NOT NULL, -- JSON array of numbers
  special_number INTEGER,
  zodiac TEXT,
  color TEXT,
  wave TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lottery_type, period, year)
);

-- 资料表（100+种资料）
CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lottery_type TEXT NOT NULL,
  period INTEGER NOT NULL,
  year INTEGER NOT NULL,
  material_type TEXT NOT NULL, -- yunchu-guanren, zhenban-shepaitu, etc.
  material_category TEXT, -- 'image', 'numbers', 'mixed', 'kill'
  image_url TEXT,
  image_r2_key TEXT,
  content TEXT, -- JSON格式存储混合内容
  numbers TEXT, -- JSON array
  description TEXT,
  is_hot INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 50,
  source_url TEXT,
  crawled_at TEXT DEFAULT CURRENT_TIMESTAMP,
  verified INTEGER DEFAULT 0,
  UNIQUE(lottery_type, period, year, material_type)
);

-- 资料类型配置表
CREATE TABLE IF NOT EXISTS material_types_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lottery_type TEXT NOT NULL,
  material_code TEXT NOT NULL,
  material_name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  data_type TEXT, -- 'image', 'numbers', 'mixed', 'kill'
  category TEXT,
  description TEXT,
  is_hot INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 50,
  is_enabled INTEGER DEFAULT 1,
  templates TEXT, -- JSON array
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lottery_type, material_code)
);

-- 用户收藏表
CREATE TABLE IF NOT EXISTS user_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  lottery_type TEXT NOT NULL,
  material_type TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, lottery_type, material_type)
);

-- 爬虫任务日志
CREATE TABLE IF NOT EXISTS crawler_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lottery_type TEXT NOT NULL,
  period INTEGER,
  year INTEGER,
  task_type TEXT, -- 'scheduled', 'manual', 'retry'
  status TEXT, -- 'success', 'failed', 'partial'
  materials_count INTEGER DEFAULT 0,
  error_message TEXT,
  duration_seconds REAL,
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_results_type_period ON lottery_results(lottery_type, period DESC);
CREATE INDEX IF NOT EXISTS idx_results_date ON lottery_results(draw_date DESC);
CREATE INDEX IF NOT EXISTS idx_materials_type_period ON materials(lottery_type, period DESC, material_type);
CREATE INDEX IF NOT EXISTS idx_materials_hot ON materials(is_hot DESC, priority ASC);
CREATE INDEX IF NOT EXISTS idx_crawler_logs_status ON crawler_logs(lottery_type, status, started_at DESC);
