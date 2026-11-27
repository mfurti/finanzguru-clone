# Quickstart: 013

Local only (web 3100, API 3101). Gates: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

| # | Story | Steps | Expected |
|---|---|---|---|
| Q1 | US1 | Remove demo data (confirm) | Only own accounts remain; all sums change accordingly |
| Q2 | US1 | Portfolios & Konten after a sync | Balances equal bank/broker or a warning shows the difference |
| Q3 | US1 | Run `audit:figures` with the own accounts; compare with the reference | Equal or ⓘ note explains |
| Q4 | US2 | Übersicht › Aktualisieren | Spinner, result per source, new "Stand"; tooltip per source; old state highlighted |
| Q5 | US3 | Hover charts; hover dashboard cards | Line follows immediately; cards do not change |
