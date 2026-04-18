# MyBooks Architecture Notes

## Goal

MyBooks を「昔の構成を復元するプロジェクト」ではなく、**自分の本棚を継続的に整理・追加できる個人用アプリ** として作り直す。

最優先は次の 2 点。

1. 本棚一覧をきれいに整備する
2. 今後も一番楽に本を追加できる動線を作る

読書メモや写真 scrap は後続機能として扱う。

## Product Direction

- local-first
- 個人利用前提
- Mac mini で Web サーバーを起動
- Android から Tailscale 経由でアクセス
- 正本は SQLite
- Google Sheets は必要時の export / backup

この方針により、運用を重くせずに一覧整備と登録体験の改善を先行できる。

## Current Source Assets

現時点での移行元資産は次のとおり。

- `MyBooks.xlsx`
  - `books`: 書誌情報と favorite、登録日時
  - `scraps`: 本に紐づく画像 URL、ページ番号、作成日時
- 旧 GAS 実装
  - `src/front.ts`: `type=book` と `type=scrap` の Web アプリ導線
  - `src/Scraps.ts`: scrap 画像の保存処理
  - `src/index.html`: カメラを開いて画像を送る画面

旧実装は参考資料として扱い、現行アプリの土台にはしない。

## Initial Data Model

最初に扱うのは `books` テーブルのみ。

想定カラム:

- `isbn`
- `title`
- `thumbnail_url`
- `authors`
- `publisher`
- `published_date`
- `amazon_url`
- `favorite`
- `registered_at`
- `updated_at`

設計メモ:

- `isbn` は `TEXT`
- `authors` は最初は単一 `TEXT`
- `amazon_url` は旧データに無いので nullable
- `updated_at` は後続の編集や再整理のために最初から持つ

## Future Data Model

将来的には `scraps` を別テーブルとして追加する。

想定イメージ:

- `id`
- `book_isbn`
- `page`
- `image_path`
- `created_at`

ここでの scrap は「本に紐づく特定ページの記録」を想定する。旧 GAS の `type=scrap` 導線はこの機能の原型として扱う。

## Delivery Sequence

### Phase 1: Data foundation

- `books` schema を固定
- `MyBooks.xlsx` から SQLite へ移行
- 件数と欠損を検証

### Phase 2: Basic app

- 本棚一覧画面
- 詳細画面またはインライン編集
- ISBN 手入力追加

### Phase 3: Scan-first registration

- スマホ向けの追加画面
- カメラ起動
- バーコード読み取り
- Google Books から書誌補完

### Phase 4: Scraps

- 本ごとの scrap 一覧
- 特定ページ付きで画像を保存
- 既存 scrap データの移行

## Non-goals For The First Iteration

- Google Sheets を正本にすること
- Android ネイティブアプリとして配布すること
- 読書メモ機能の本格実装
- scrap の全面対応

## Operational Notes

- 個人用なので、まずは local-first でよい
- Android からの利用は Tailscale HTTPS 経由を前提にする
- データの見やすさや検索性はアプリ側で担保し、外部サービス依存を増やしすぎない
