# MyBooks

自分用のローカル書籍管理アプリです。

Mac mini 上で `app/server.py` を `127.0.0.1:8000` に立ち上げ、Tailscale HTTPS 経由でスマホからアクセスします。スマホでは本の登録、バーコード読み取り、本ごとの scrap 写真撮影を行います。

## いつもの起動

repo root で次を実行します。

```bash
/Users/shirai/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  app/server.py \
  --db data/mybooks.db \
  --host 127.0.0.1 \
  --port 8000
```

ローカル確認:

- Web app: `http://127.0.0.1:8000`
- Health check: `http://127.0.0.1:8000/api/health`
- Books API: `http://127.0.0.1:8000/api/books`

## スマホから使う

Tailscale Serve で `127.0.0.1:8000` を HTTPS 公開します。

```bash
tailscale serve --bg --https=443 127.0.0.1:8000
tailscale serve status
```

現在のアクセス URL:

```text
https://mac-mini.tail46ee8b.ts.net
```

スマホ側も同じ tailnet の Tailscale に接続してから、この URL を開きます。カメラ利用があるため、スマホでは raw IP ではなく Tailscale の HTTPS URL で開きます。

## 使い方

### 本を探す・読む

- 一覧画面でタイトル、著者、出版社、ISBN を検索する
- `favorite のみ` で favorite 登録済みの本だけに絞る
- 本をタップすると詳細画面に移動する
- 詳細画面で、その本に紐づく scrap 写真を読む

### 本を追加する

- 一覧画面の `登録` を開く
- ISBN を入力して `Google Books から追加`
- スマホでは `スキャンで追加` から ISBN バーコードを読む
- `BarcodeDetector` 非対応端末では ISBN を手入力する

匿名 quota で Google Books が 429 を返す場合は、repo root の `.env.local` に次を入れてから起動します。

```text
GOOGLE_BOOKS_API_KEY=...
```

`app/server.py` は起動時に `.env.local` を読みます。

### scrap 写真を撮る

- 一覧から本を開く
- 詳細画面の `撮影する` を押す
- 必要ならページ番号を入れる
- `撮影`、確認、`保存`

保存先:

- SQLite DB: `data/mybooks.db`
- scrap 画像: `data/scraps/<isbn>/`
- schema: `scripts/schema.sql`

## 運用メモ

Tailscale の公開状態を確認する:

```bash
tailscale serve status
```

既存の Tailscale Serve 設定を消してやり直す:

```bash
tailscale serve reset
```

サーバを止める:

- 起動している terminal で `Ctrl-C`

## legacy import

過去の xlsx の `scraps` シートに入っている Google Drive 画像をローカルへ落として SQLite に登録するときだけ使います。

```bash
/Users/shirai/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  scripts/import_mybooks_scraps.py \
  --input /Users/shirai/Downloads/MyBooks.xlsx \
  --db data/mybooks.db
```

- 画像は `data/scraps/<isbn>/` に保存される
- すでに入っている scrap は再実行時にスキップする

## design docs

- `docs/architecture.md`
- `docs/decisions/ADR-2026-04-18-local-first-web-architecture.md`
