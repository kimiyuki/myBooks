PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS books (
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

CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_favorite ON books(favorite);

CREATE TABLE IF NOT EXISTS scraps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_isbn TEXT NOT NULL,
  page INTEGER,
  image_path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  FOREIGN KEY (book_isbn) REFERENCES books(isbn) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scraps_book_created ON scraps(book_isbn, created_at DESC);
