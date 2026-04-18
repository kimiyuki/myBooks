# Napkin Runbook

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[2026-04-18] まずデータ正本を決めてから UI を作る**
   Do instead: schema と import 手順を先に固定し、一覧や登録導線はその上に載せる。
2. **[2026-04-18] 旧 GAS/Glide を延命しない**
   Do instead: `MyBooks.xlsx` を移行元として扱い、現行用途に合わせた local-first 構成へ作り直す。

## Domain Behavior Guardrails
1. **[2026-04-18] `books` を先に、`scraps` は後で**
   Do instead: 最初の実装は本棚一覧の整備と登録動線に絞り、読書メモや scrap は別段階で足す。
2. **[2026-04-18] `isbn` は文字列で扱う**
   Do instead: SQLite でも import でも `isbn` は `TEXT` に統一し、数値変換しない。

## User Directives
1. **[2026-04-18] 自分用の運用を優先**
   Do instead: Google Sheets 正本や Android ネイティブを前提にせず、Mac mini + Tailscale + Web で軽く始める。
2. **[2026-04-18] 判断は ADR と設計メモに残す**
   Do instead: 重要な設計判断は `docs/decisions/` に、全体方針は `docs/architecture.md` に集約する。
