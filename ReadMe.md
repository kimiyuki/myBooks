# 書籍管理を Apps Scriptと GlideApps.ioで作る

できれば、管理する本単位で撮ったスナップ写真？も管理できるようにする

<img src="https://i.gyazo.com/d708db7c1243fa9a2b4928672397e187.jpg" width="50px"/>
<img src="https://i.gyazo.com/2c03509cf6d3c4491ff08884f11a540f.png" width="100px"/>

> 参考にする 
- [GAS×スプレッドシート×GlideApps×Slack×Pic2shopで作る書籍管理アプリの実装 - Qiita](https://qiita.com/mgmgOmO/items/0c1e14385875ac30878a)
## Claspの始め方

以下を参考にする
(https://qiita.com/mgmgOmO/items/0c1e14385875ac30878a)
- [Google Apps ScriptをTypeScriptで実装する(clasp/TSLint/Prettier) #gas #typescript - My External Storage](https://budougumi0617.github.io/2019/01/16/develop-google-apps-script-by-typescript/)
- [google/clasp: 🔗 Command Line Apps Script Projects](https://github.com/google/clasp)

## install


## setup

## development

## design docs

- `docs/architecture.md`
- `docs/decisions/ADR-2026-04-18-local-first-web-architecture.md`

## local-first restart

SQLite 正本へ移す初期実装を `scripts/` に置いています。

### import legacy xlsx to sqlite

`openpyxl` が必要です。Codex で検証したときは bundled runtime の Python を使いました。

```bash
/Users/shirai/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  scripts/import_mybooks_xlsx.py \
  --input /Users/shirai/Downloads/MyBooks.xlsx \
  --output data/mybooks.db \
  --replace
```

作成される SQLite schema は `scripts/schema.sql` にあります。

### run local web app

```bash
/Users/shirai/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  app/server.py \
  --db data/mybooks.db \
  --host 127.0.0.1 \
  --port 8000
```

一覧 API は `/api/books`、ISBN 追加は `POST /api/books` です。
匿名 quota で Google Books が 429 を返す環境では、repo root の `.env.local` に `GOOGLE_BOOKS_API_KEY=...` を入れてから起動してください。`app/server.py` は起動時に `.env.local` を読みます。

### barcode scanning

- 一覧画面の `スキャンで追加` からバーコード読み取りを開始する
- Android では Tailscale HTTPS URL で開いてから使う
- 読み取りに成功すると ISBN をそのまま追加する
- 端末が `BarcodeDetector` 非対応なら手入力で追加する

### expose the local web app over Tailscale

1. ローカル Web アプリを `127.0.0.1:8000` で起動する
2. そのポートを Tailscale HTTPS で tailnet 内公開する

```bash
tailscale serve --bg --https=443 127.0.0.1:8000
tailscale serve status
```

補足:

- Android からカメラを使う前提では、raw IP ではなく `https://<node>.<tailnet>.ts.net/` で開く
- 既存設定を消してやり直すときは `tailscale serve reset`
