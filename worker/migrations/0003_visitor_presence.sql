-- Current Visitor presence for public Online Visitor Count.
CREATE TABLE IF NOT EXISTS visitor_presence (
  visitor_key TEXT PRIMARY KEY,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_visitor_presence_last_seen_at
ON visitor_presence (last_seen_at);
