ALTER TABLE article_comments ADD COLUMN parent_comment_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_article_comments_parent_comment_id
ON article_comments (parent_comment_id, created_at);
