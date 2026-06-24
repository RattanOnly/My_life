ALTER TABLE visitor_logs ADD COLUMN visitor_location TEXT DEFAULT '未知地区';

CREATE TABLE IF NOT EXISTS owner_ip_marks (
  ip_address TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
