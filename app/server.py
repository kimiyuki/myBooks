#!/usr/bin/env python3
"""Minimal local-first MyBooks web app."""

from __future__ import annotations

import argparse
import base64
import binascii
import json
import mimetypes
import os
import sqlite3
import time
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

SCRAPS_SELECT = """
SELECT
  id,
  book_isbn,
  page,
  image_path,
  created_at
FROM scraps
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


def normalize_openbd_published_date(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if len(text) == 8 and text.isdigit():
        return f"{text[:4]}-{text[4:6]}-{text[6:]}"
    if len(text) == 6 and text.isdigit():
        return f"{text[:4]}-{text[4:6]}"
    if len(text) == 4 and text.isdigit():
        return text
    return text or None


def normalize_page(value: Any) -> int | None:
    if value in (None, ""):
        return None
    text = str(value).strip()
    if not text:
        return None
    page = int(text)
    if page < 0:
        raise ValueError("page must be 0 or greater")
    return page


def parse_data_url_image(data_url: str) -> tuple[bytes, str]:
    if not isinstance(data_url, str) or not data_url.startswith("data:image/"):
        raise ValueError("image_data_url must be a data URL for an image")
    header, _, encoded = data_url.partition(",")
    if ";base64" not in header or not encoded:
        raise ValueError("image_data_url must be a base64-encoded image")
    mime_type = header[5:].split(";", 1)[0]
    if mime_type not in {"image/jpeg", "image/png"}:
        raise ValueError("only jpeg and png scrap images are supported")
    try:
        image_bytes = base64.b64decode(encoded, validate=True)
    except binascii.Error as exc:
        raise ValueError("image_data_url is not valid base64") from exc
    return image_bytes, mime_type


def file_extension_for_mime_type(mime_type: str) -> str:
    if mime_type == "image/jpeg":
        return ".jpg"
    if mime_type == "image/png":
        return ".png"
    raise ValueError(f"unsupported mime type: {mime_type}")


def row_to_book(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return dict(row)


def scrap_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    data["media_url"] = f"/media/{data['image_path']}"
    return data


def attach_book_scrap_summaries(
    connection: sqlite3.Connection, books: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    if not books:
        return books

    isbns = [book["isbn"] for book in books]
    placeholders = ", ".join("?" for _ in isbns)

    count_rows = connection.execute(
        f"""
        SELECT book_isbn, COUNT(*) AS scrap_count
        FROM scraps
        WHERE book_isbn IN ({placeholders})
        GROUP BY book_isbn
        """,
        isbns,
    ).fetchall()
    counts = {row["book_isbn"]: row["scrap_count"] for row in count_rows}

    preview_rows = connection.execute(
        f"""
        SELECT id, book_isbn, page, image_path, created_at
        FROM (
          SELECT
            id,
            book_isbn,
            page,
            image_path,
            created_at,
            ROW_NUMBER() OVER (
              PARTITION BY book_isbn
              ORDER BY created_at DESC, id DESC
            ) AS row_number
          FROM scraps
          WHERE book_isbn IN ({placeholders})
        )
        WHERE row_number <= 2
        ORDER BY book_isbn, created_at DESC, id DESC
        """,
        isbns,
    ).fetchall()

    previews_by_isbn: dict[str, list[dict[str, Any]]] = {}
    for row in preview_rows:
        previews_by_isbn.setdefault(row["book_isbn"], []).append(scrap_row_to_dict(row))

    for book in books:
        book["scrap_count"] = counts.get(book["isbn"], 0)
        book["scrap_previews"] = previews_by_isbn.get(book["isbn"], [])
    return books


def ensure_runtime_schema(db_path: Path, schema_path: Path) -> None:
    schema_sql = schema_path.read_text(encoding="utf-8")
    with sqlite3.connect(db_path) as connection:
        connection.executescript(schema_sql)


def read_error_payload(exc: HTTPError) -> dict[str, Any] | None:
    try:
        raw = exc.read()
    except Exception:
        return None
    if not raw:
        return None
    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def is_temporary_google_books_error(exc: HTTPError) -> bool:
    payload = read_error_payload(exc)
    errors = payload.get("error", {}).get("errors", []) if payload else []
    reasons = [str(item.get("reason", "")).strip() for item in errors if isinstance(item, dict)]
    return exc.code == 503 and "backendFailed" in reasons


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
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urlopen(request, timeout=10) as response:
                payload = json.load(response)
            break
        except HTTPError as exc:
            last_error = exc
            if exc.code == 429 and not api_key:
                raise RuntimeError(
                    "google books quota exceeded. Set GOOGLE_BOOKS_API_KEY and retry."
                ) from exc
            if is_temporary_google_books_error(exc) and attempt < 2:
                time.sleep(0.6 * (attempt + 1))
                continue
            raise RuntimeError(f"google books request failed: {exc.code}") from exc
        except URLError as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(0.6 * (attempt + 1))
                continue
            raise RuntimeError(f"google books request failed: {exc.reason}") from exc
    else:
        raise RuntimeError("google books request failed") from last_error

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


def fetch_openbd_book_by_isbn(isbn: str) -> dict[str, Any]:
    url = f"https://api.openbd.jp/v1/get?isbn={isbn}"
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
        raise RuntimeError(f"openBD request failed: {exc.code}") from exc
    except URLError as exc:
        raise RuntimeError(f"openBD request failed: {exc.reason}") from exc

    if not isinstance(payload, list) or not payload or payload[0] is None:
        raise LookupError(f"isbn {isbn} was not found in openBD")

    record = payload[0]
    summary = record.get("summary") or {}
    title = str(summary.get("title") or "").strip()
    authors = str(summary.get("author") or "").replace(",", ", ").strip()
    if not title:
        raise RuntimeError("openBD returned a record without title")
    if not authors:
        authors = "著者未設定"

    return {
        "isbn": isbn,
        "title": title,
        "thumbnail_url": str(summary.get("cover") or "").strip() or None,
        "authors": authors,
        "publisher": str(summary.get("publisher") or "").strip() or None,
        "published_date": normalize_openbd_published_date(summary.get("pubdate")),
        "amazon_url": None,
    }


def fetch_book_by_isbn(isbn: str) -> dict[str, Any]:
    try:
        return fetch_google_book_by_isbn(isbn)
    except LookupError:
        raise
    except RuntimeError as exc:
        if "503" not in str(exc):
            raise
    return fetch_openbd_book_by_isbn(isbn)


class MyBooksHandler(SimpleHTTPRequestHandler):
    server_version = "MyBooksHTTP/0.1"

    def __init__(self, *args: Any, db_path: Path, media_root: Path, directory: Path, **kwargs: Any) -> None:
        self.db_path = db_path
        self.media_root = media_root
        super().__init__(*args, directory=str(directory), **kwargs)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path.startswith("/media/"):
            self.handle_media_get(parsed.path)
            return
        if parsed.path == "/api/health":
            self.respond_json(HTTPStatus.OK, {"ok": True})
            return
        if parsed.path == "/api/books":
            self.handle_list_books(parsed.query)
            return
        if parsed.path.startswith("/api/books/"):
            self.handle_book_api_get(parsed.path)
            return
        if parsed.path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/books":
            self.handle_add_book()
            return
        if parsed.path.startswith("/api/books/"):
            self.handle_book_api_post(parsed.path)
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
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def get_book(self, connection: sqlite3.Connection, isbn: str) -> sqlite3.Row | None:
        return connection.execute(
            f"{BOOKS_SELECT} WHERE isbn = ?",
            (isbn,),
        ).fetchone()

    def handle_book_api_get(self, path: str) -> None:
        parts = path.strip("/").split("/")
        if len(parts) < 3:
            self.respond_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
            return

        try:
            isbn = normalize_isbn(parts[2])
        except ValueError as exc:
            self.respond_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            return

        if len(parts) == 3:
            self.handle_get_book_detail(isbn)
            return
        if len(parts) == 4 and parts[3] == "scraps":
            self.handle_list_scraps(isbn)
            return

        self.respond_json(HTTPStatus.NOT_FOUND, {"error": "not found"})

    def handle_book_api_post(self, path: str) -> None:
        parts = path.strip("/").split("/")
        if len(parts) == 4 and parts[0] == "api" and parts[1] == "books" and parts[3] == "scraps":
            try:
                isbn = normalize_isbn(parts[2])
            except ValueError as exc:
                self.respond_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return
            self.handle_create_scrap(isbn)
            return
        self.respond_json(HTTPStatus.NOT_FOUND, {"error": "not found"})

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
            books = attach_book_scrap_summaries(connection, books)

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
            existing = connection.execute("SELECT isbn, title FROM books WHERE isbn = ?", (isbn,)).fetchone()
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
                fetched = fetch_book_by_isbn(isbn)
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
            book = self.get_book(connection, isbn)

        self.respond_json(HTTPStatus.CREATED, {"book": dict(book)})

    def handle_get_book_detail(self, isbn: str) -> None:
        with self.connect_db() as connection:
            book = self.get_book(connection, isbn)
        if book is None:
            self.respond_json(HTTPStatus.NOT_FOUND, {"error": "book not found"})
            return
        self.respond_json(HTTPStatus.OK, {"book": dict(book)})

    def handle_list_scraps(self, isbn: str) -> None:
        with self.connect_db() as connection:
            book = self.get_book(connection, isbn)
            if book is None:
                self.respond_json(HTTPStatus.NOT_FOUND, {"error": "book not found"})
                return
            scraps = [
                scrap_row_to_dict(row)
                for row in connection.execute(
                    f"{SCRAPS_SELECT} WHERE book_isbn = ? ORDER BY created_at DESC, id DESC",
                    (isbn,),
                ).fetchall()
            ]
        self.respond_json(HTTPStatus.OK, {"book": dict(book), "scraps": scraps})

    def handle_create_scrap(self, isbn: str) -> None:
        try:
            payload = self.read_json_body()
            image_data_url = payload.get("image_data_url")
            image_bytes, mime_type = parse_data_url_image(image_data_url)
            page = normalize_page(payload.get("page"))
        except ValueError as exc:
            self.respond_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            return

        timestamp = utc_now_text()
        timestamp_slug = timestamp.replace(":", "").replace("-", "")
        suffix = file_extension_for_mime_type(mime_type)
        relative_dir = Path("scraps") / isbn
        filename = f"{timestamp_slug}{suffix}"
        relative_path = relative_dir / filename
        absolute_dir = self.media_root / relative_dir
        absolute_path = self.media_root / relative_path
        absolute_dir.mkdir(parents=True, exist_ok=True)
        absolute_path.write_bytes(image_bytes)

        with self.connect_db() as connection:
            book = self.get_book(connection, isbn)
            if book is None:
                absolute_path.unlink(missing_ok=True)
                self.respond_json(HTTPStatus.NOT_FOUND, {"error": "book not found"})
                return

            connection.execute(
                """
                INSERT INTO scraps (
                  book_isbn,
                  page,
                  image_path,
                  created_at
                ) VALUES (?, ?, ?, ?)
                """,
                (
                    isbn,
                    page,
                    relative_path.as_posix(),
                    timestamp,
                ),
            )
            scrap = connection.execute(
                f"{SCRAPS_SELECT} WHERE image_path = ?",
                (relative_path.as_posix(),),
            ).fetchone()

        self.respond_json(HTTPStatus.CREATED, {"scrap": scrap_row_to_dict(scrap)})

    def handle_media_get(self, path: str) -> None:
        relative_path = path.removeprefix("/media/").strip("/")
        if not relative_path:
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        candidate = (self.media_root / relative_path).resolve()
        media_root_resolved = self.media_root.resolve()
        if media_root_resolved not in candidate.parents and candidate != media_root_resolved:
            self.send_error(HTTPStatus.FORBIDDEN)
            return
        if not candidate.exists() or not candidate.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        content_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
        data = candidate.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parent.parent
    load_dotenv(repo_root / ".env.local")
    db_path = args.db.resolve()
    if not db_path.exists():
        raise SystemExit(f"database not found: {db_path}")

    static_dir = Path(__file__).resolve().parent / "static"
    ensure_runtime_schema(db_path, repo_root / "scripts" / "schema.sql")
    handler = partial(
        MyBooksHandler,
        db_path=db_path,
        media_root=db_path.parent,
        directory=static_dir,
    )
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
