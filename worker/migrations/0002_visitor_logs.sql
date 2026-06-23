-- Private Visitor Logs for public page visits.
CREATE TABLE IF NOT EXISTS visitor_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT NOT NULL,
  visited_at TEXT NOT NULL,
  visited_page TEXT NOT NULL,
  visitor_device_summary TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_visitor_logs_visited_at
ON visitor_logs (visited_at);
