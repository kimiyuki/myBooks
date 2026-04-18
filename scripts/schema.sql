PRAGMA foreign_keys = ON;

CREATE TABLE books (
  isbn TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  authors TEXT NOT NULL,
  publisher TEXT,
  published_date TEXT,
  amazon_url TEXT,
  favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
  registered_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_favorite ON books(favorite);
