---
id: ADR-2026-04-18-local-first-web-architecture
status: accepted
date: 2026-04-18
tags:
  - architecture
  - storage
  - web
  - mobile
related:
  - ReadMe.md
  - src/front.ts
  - src/Scraps.ts
supersedes: []
superseded_by: ""
---

# Local-first Web Architecture For MyBooks

## Context

`mybooks` は 2020 年頃の Google Apps Script + Google Spreadsheet + Glide + Pic2shop を前提にした個人向け書籍管理アプリだった。今回の再開では、まず本棚一覧の整備と今後の登録導線を最優先にしたい。

現時点で確認できている前提は次のとおり。

- 旧データは `MyBooks.xlsx` に残っており、`books` と `scraps` を中心に十分再利用できる
- 旧実装には `type=scrap` の Web アプリ導線があり、将来的にページ単位の scrap 記録へ活かせる
- いま欲しいのは読書メモより先に「一覧を整えること」と「本を楽に追加できること」
- Android ネイティブアプリは最終候補ではあるが、初手としては実装/運用コストが重い
- このプロジェクトは個人利用が前提であり、まずは自分が使い続けやすい構成を優先してよい

## Decision

本プロジェクトは、当面 **local-first の Web アプリ** として再構成する。

- 正本データは **Mac mini 上の SQLite**
- UI は **スマホから使える Web アプリ**
- Android 端末からは **Tailscale 経由で HTTPS アクセス**
- 旧 Google Spreadsheet は移行元データとして扱い、正本にはしない
- Google Sheets が必要になった場合は export / backup 用として扱う
- 最初の実装対象は `books` 一覧と登録導線に限定し、`scraps` は後続段階で扱う

## Alternatives Considered

### 1. 旧 GAS + Spreadsheet + Glide 構成を復旧する

採用しない。

理由:

- 旧サービス依存が強く、今後の項目追加や導線変更に弱い
- データモデルがシート列に強く依存している
- 現在の目的は保守より再設計の方が適している

### 2. 最初から Android ネイティブアプリにする

現時点では採用しない。

理由:

- 一覧整備と登録導線の確立より先に、実装/配布/保守コストが増える
- local-first Web でもカメラ起動とバーコード読み取りの段階まで十分到達できる
- まず個人利用に必要な最短の体験を固めたい

### 3. Google Sheets を正本にする

現時点では採用しない。

理由:

- スキーマ変更とアプリ都合のデータ構造変更がやりづらい
- 認証や API 書き込み、失敗時ハンドリングの責務が増える
- 一人用の再開プロジェクトとしては SQLite 正本の方が軽い

## Consequences

### Positive

- 実装対象を小さく保てる
- 本棚一覧の整備からすぐ着手できる
- 将来 `scraps` やメモ、検索、エクスポートを足しやすい
- Android ネイティブへ進みたくなった場合も、SQLite 中心のモデルは移行しやすい

### Negative

- 最初の段階では Google Sheets とのリアルタイム同期は持たない
- Android アプリらしい OS 統合は後回しになる
- 画像 scrap を活かすには後続でローカル画像保存の設計が必要になる

## Implementation Notes

- `books` の最小 schema を先に固定する
- `MyBooks.xlsx` から SQLite への import スクリプトを作る
- 一覧画面と ISBN 追加を先に実装する
- バーコード読み取りはその後に Web カメラ導線として足す
- `scraps` は別テーブルとして切り出し、本ごと・ページごとに保存できる形へ寄せる
