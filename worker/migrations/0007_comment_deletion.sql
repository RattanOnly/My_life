ALTER TABLE article_comments ADD COLUMN delete_token_hash TEXT;

ALTER TABLE article_comments ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_article_comments_deleted_at
ON article_comments (deleted_at);
