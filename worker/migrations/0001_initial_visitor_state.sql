-- Initial Visitor state schema for the Cloudflare D1 sidecar.
-- Later slices will add the concrete Visitor Log and presence tables.
CREATE TABLE IF NOT EXISTS sidecar_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO sidecar_meta (key, value)
VALUES ('schema_version', '1');
