# Quickstart: 013

Local only (web 3100, API 3101). Gates: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

| # | Story | Steps | Expected |
|---|---|---|---|
| Q1 | US1 | Remove demo data (confirm) | Only own accounts remain; all sums change accordingly |
| Q2 | US1 | Portfolios & Konten after a sync | Balances equal bank/broker or a warning shows the difference |
| Q3 | US1 | Run `audit:figures` with the own accounts; compare with the reference | Equal or ⓘ note explains |
| Q4 | US2 | Übersicht › Aktualisieren | Spinner, result per source, new "Stand"; tooltip per source; old state highlighted |
| Q5 | US3 | Hover charts; hover dashboard cards | Line follows immediately; cards do not change |

## Status after T006 (2026-11-27, no amounts)

| Gap | Result |
|---|---|
| A18 (one month bar) | Explained: the reference counts the monthly transfer from the giro account to the broker's cash account as income and as expense (and its own Sankey shows a different income for that month than its bars). The app treats transfers between own accounts as neither; ⓘ notes on Einnahmen and Ausgaben say so. |
| A2/A4 (period gain, price gain) | Reference period base still not derivable from its UI; ⓘ notes state the app's definition and that values can differ. |
| A5 (realized net) | Broker sync delivers no tax per sell; ⓘ note says net = gross for sells. |
| New in T004 | Sankey showed Einnahmen larger than the real income in months with a deficit; fixed ("Fehlbetrag" block), covered by the consistency tests. |
