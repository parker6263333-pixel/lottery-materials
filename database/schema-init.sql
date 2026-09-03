CREATE TABLE IF NOT EXISTS lottery_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lottery_type TEXT NOT NULL,
  period INTEGER NOT NULL,
  year INTEGER NOT NULL,
  draw_date TEXT NOT NULL,
  draw_time TEXT,
  numbers TEXT NOT NULL,
  special_number INTEGER,
  zodiac TEXT,
  color TEXT,
  wave TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lottery_type, period, year)
);

CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lottery_type TEXT NOT NULL,
  period INTEGER NOT NULL,
  year INTEGER NOT NULL,
  material_type TEXT NOT NULL,
  material_category TEXT,
  image_url TEXT,
  image_r2_key TEXT,
  content TEXT,
  numbers TEXT,
  description TEXT,
  is_hot INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 50,
  source_url TEXT,
  crawled_at TEXT DEFAULT CURRENT_TIMESTAMP,
  verified INTEGER DEFAULT 0,
  UNIQUE(lottery_type, period, year, material_type)
);

CREATE TABLE IF NOT EXISTS material_types_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lottery_type TEXT NOT NULL,
  material_code TEXT NOT NULL,
  material_name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  data_type TEXT,
  category TEXT,
  description TEXT,
  is_hot INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 50,
  is_enabled INTEGER DEFAULT 1,
  templates TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lottery_type, material_code)
);

CREATE TABLE IF NOT EXISTS user_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  lottery_type TEXT NOT NULL,
  material_type TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, lottery_type, material_type)
);

CREATE TABLE IF NOT EXISTS crawler_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lottery_type TEXT NOT NULL,
  period INTEGER,
  year INTEGER,
  task_type TEXT,
  status TEXT,
  materials_count INTEGER DEFAULT 0,
  error_message TEXT,
  duration_seconds REAL,
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_results_type_period ON lottery_results(lottery_type, period DESC);
CREATE INDEX IF NOT EXISTS idx_results_date ON lottery_results(draw_date DESC);
CREATE INDEX IF NOT EXISTS idx_materials_type_period ON materials(lottery_type, period DESC, material_type);
CREATE INDEX IF NOT EXISTS idx_materials_hot ON materials(is_hot DESC, priority ASC);
CREATE INDEX IF NOT EXISTS idx_crawler_logs_status ON crawler_logs(lottery_type, status, started_at DESC);
