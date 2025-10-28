-- 图表配置表
CREATE TABLE IF NOT EXISTS charts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  config TEXT NOT NULL,
  chart_type TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 聚合数据表
CREATE TABLE IF NOT EXISTS chart_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chart_id TEXT NOT NULL,
  date TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chart_id) REFERENCES charts (id)
);

-- 原始数据缓存表
CREATE TABLE IF NOT EXISTS raw_data_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bury_point_id TEXT NOT NULL,
  date TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(bury_point_id, date)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_chart_data_chart_id ON chart_data(chart_id);
CREATE INDEX IF NOT EXISTS idx_chart_data_date ON chart_data(date);
CREATE INDEX IF NOT EXISTS idx_raw_data_cache_bury_point_id ON raw_data_cache(bury_point_id);
CREATE INDEX IF NOT EXISTS idx_raw_data_cache_date ON raw_data_cache(date);
CREATE INDEX IF NOT EXISTS idx_raw_data_cache_bury_point_date ON raw_data_cache(bury_point_id, date);
