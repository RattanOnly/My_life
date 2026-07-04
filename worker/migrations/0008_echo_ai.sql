CREATE TABLE IF NOT EXISTS echo_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO echo_settings (setting_key, setting_value)
VALUES ('is_enabled', '1')
ON CONFLICT(setting_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS echo_usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  event_status TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  retrieved_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT
);

CREATE INDEX IF NOT EXISTS idx_echo_usage_events_created_at
ON echo_usage_events(created_at);
