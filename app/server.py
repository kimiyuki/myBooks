#!/usr/bin/env python3
"""Minimal local-first MyBooks web app."""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import sqlite3
from datetime import datetime
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen


BOOKS_SELECT = """
SELECT
  isbn,
  title,
  thumbnail_url,
  authors,
  publisher,
  published_date,
  amazon_url,
  favorite,
  registered_at,
  updated_at
FROM books
"""


def load_dotenv(dotenv_path: Path) -> None:
    if not dotenv_path.exists():
        return

    for line in dotenv_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = value


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the MyBooks local web app.")
    parser.add_argument(
        "--db",
        default=Path("data/mybooks.db"),
        type=Path,
        help="Path to the SQLite database.",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host to bind the local web server to.",
    )
    parser.add_argument(
        "--port",
        default=8000,
        type=int,
        help="Port to bind the local web server to.",
    )
    return parser.parse_args()


def normalize_isbn(value: Any) -> str:
    text = str(value).replace("-", "").strip()
    if not text:
        raise ValueError("isbn is required")
    if not all(char.isdigit() or char.upper() == "X" for char in text):
        raise ValueError("isbn must contain only digits, hyphen, or X")
    return text.upper()


def utc_now_text() -> str:
    return datetime.now().replace(microsecond=0).isoformat()


def normalize_google_published_date(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def fetch_google_book_by_isbn(isbn: str) -> dict[str, Any]:
    query_params = {
        "q": f"isbn:{isbn}",
        "country": "JP",
    }
    api_key = os.getenv("GOOGLE_BOOKS_API_KEY")
    if api_key:
        query_params["key"] = api_key
    url = f"https://www.googleapis.com/books/v1/volumes?{urlencode(query_params)}"
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "MyBooks/0.1 (+local-first)",
        },
    )
    try:
        with urlopen(request, timeout=10) as response:
            payload = json.load(response)
    except HTTPError as exc:
        if exc.code == 429 and not api_key:
            raise RuntimeError(
                "google books quota exceeded. Set GOOGLE_BOOKS_API_KEY and retry."
            ) from exc
        raise RuntimeError(f"google books request failed: {exc.code}") from exc
    except URLError as exc:
        raise RuntimeError(f"google books request failed: {exc.reason}") from exc

    total_items = payload.get("totalItems", 0)
    items = payload.get("items") or []
    if total_items < 1 or not items:
        raise LookupError(f"isbn {isbn} was not found in Google Books")

    volume_info = items[0].get("volumeInfo") or {}
    title = str(volume_info.get("title") or "").strip()
    authors = volume_info.get("authors") or []
    if not title:
        raise RuntimeError("google books returned a record without title")

    normalized_authors = ", ".join(
        str(author).strip() for author in authors if str(author).strip()
    )
    if not normalized_authors:
        normalized_authors = "著者未設定"

    image_links = volume_info.get("imageLinks") or {}
    return {
        "isbn": isbn,
        "title": title,
        "thumbnail_url": image_links.get("thumbnail") or image_links.get("smallThumbnail"),
        "authors": normalized_authors,
        "publisher": (str(volume_info.get("publisher")).strip() if volume_info.get("publisher") else None),
        "published_date": normalize_google_published_date(volume_info.get("publishedDate")),
        "amazon_url": None,
    }


class MyBooksHandler(SimpleHTTPRequestHandler):
    server_version = "MyBooksHTTP/0.1"

    def __init__(self, *args: Any, db_path: Path, directory: Path, **kwargs: Any) -> None:
        self.db_path = db_path
        super().__init__(*args, directory=str(directory), **kwargs)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.respond_json(HTTPStatus.OK, {"ok": True})
            return
        if parsed.path == "/api/books":
            self.handle_list_books(parsed.query)
            return
        if parsed.path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/books":
            self.handle_add_book()
            return
        self.respond_json(HTTPStatus.NOT_FOUND, {"error": "not found"})

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def guess_type(self, path: str) -> str:
        if path.endswith(".js"):
            return "text/javascript; charset=utf-8"
        if path.endswith(".css"):
            return "text/css; charset=utf-8"
        return mimetypes.guess_type(path)[0] or "application/octet-stream"

    def respond_json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self) -> dict[str, Any]:
        content_length = self.headers.get("Content-Length")
        if content_length is None:
            raise ValueError("Content-Length header is required")
        raw_body = self.rfile.read(int(content_length))
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError("request body must be valid JSON") from exc
        if not isinstance(payload, dict):
            raise ValueError("request body must be a JSON object")
        return payload

    def connect_db(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def handle_list_books(self, query_string: str) -> None:
        params = parse_qs(query_string)
        query = (params.get("q", [""])[0] or "").strip()
        favorites_only = params.get("favorite", ["0"])[0] == "1"

        sql = [BOOKS_SELECT]
        conditions: list[str] = []
        bindings: list[Any] = []
        if query:
            like = f"%{query}%"
            conditions.append(
                "(isbn LIKE ? OR title LIKE ? OR authors LIKE ? OR COALESCE(publisher, '') LIKE ?)"
            )
            bindings.extend([like, like, like, like])
        if favorites_only:
            conditions.append("favorite = 1")
        if conditions:
            sql.append("WHERE " + " AND ".join(conditions))
        sql.append("ORDER BY registered_at DESC, title COLLATE NOCASE ASC")

        with self.connect_db() as connection:
            books = [dict(row) for row in connection.execute("\n".join(sql), bindings).fetchall()]

        self.respond_json(
            HTTPStatus.OK,
            {
                "books": books,
                "count": len(books),
            },
        )

    def handle_add_book(self) -> None:
        try:
            payload = self.read_json_body()
            isbn = normalize_isbn(payload.get("isbn"))
        except ValueError as exc:
            self.respond_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            return

        with self.connect_db() as connection:
            existing = connection.execute(
                "SELECT isbn, title FROM books WHERE isbn = ?",
                (isbn,),
            ).fetchone()
            if existing is not None:
                self.respond_json(
                    HTTPStatus.CONFLICT,
                    {
                        "error": "book already exists",
                        "book": dict(existing),
                    },
                )
                return

            try:
                fetched = fetch_google_book_by_isbn(isbn)
            except LookupError as exc:
                self.respond_json(HTTPStatus.NOT_FOUND, {"error": str(exc)})
                return
            except RuntimeError as exc:
                self.respond_json(HTTPStatus.BAD_GATEWAY, {"error": str(exc)})
                return

            timestamp = utc_now_text()
            connection.execute(
                """
                INSERT INTO books (
                  isbn,
                  title,
                  thumbnail_url,
                  authors,
                  publisher,
                  published_date,
                  amazon_url,
                  favorite,
                  registered_at,
                  updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    fetched["isbn"],
                    fetched["title"],
                    fetched["thumbnail_url"],
                    fetched["authors"],
                    fetched["publisher"],
                    fetched["published_date"],
                    fetched["amazon_url"],
                    0,
                    timestamp,
                    timestamp,
                ),
            )
            book = connection.execute(
                f"{BOOKS_SELECT} WHERE isbn = ?",
                (isbn,),
            ).fetchone()

        self.respond_json(HTTPStatus.CREATED, {"book": dict(book)})


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parent.parent
    load_dotenv(repo_root / ".env.local")
    db_path = args.db.resolve()
    if not db_path.exists():
        raise SystemExit(f"database not found: {db_path}")

    static_dir = Path(__file__).resolve().parent / "static"
    handler = partial(MyBooksHandler, db_path=db_path, directory=static_dir)
    server = ThreadingHTTPServer((args.host, args.port), handler)

    print(f"MyBooks server listening on http://{args.host}:{args.port}")
    print(f"Using database: {db_path}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
