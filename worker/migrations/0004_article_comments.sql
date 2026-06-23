CREATE TABLE IF NOT EXISTS article_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_path TEXT NOT NULL,
  comment_name TEXT NOT NULL,
  comment_email TEXT,
  comment_body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_article_comments_article_path_created_at
ON article_comments (article_path, created_at);
