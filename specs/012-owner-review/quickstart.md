# Quickstart: Owner Review Round (012)

Local only (web 3100, API 3101). Gates: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

| # | Points | Steps | Expected |
|---|---|---|---|
| Q1 | P3, P5 | Switch Dashboard → Portfolios & Konten → Transaktionen; open Investments | Side navigation stays; Investments shows "Buchungen", "Watchlist" |
| Q2 | P1, P2 | Open Spalten on Transaktionen and Positionen; change, reorder, save, reload | Reference columns; choice and order kept |
| Q3 | P4, P15 | Investments › Buchungen; open the account filter in Investments | Kauf green, Verkauf blue badge; only portfolios offered |
| Q4 | P6–P8 | Dividenden with the owner's accounts; Aufteilung › Währungen | Years match the reference or difference explained; three cards; currencies |
| Q5 | P9 | Steuern › Freistellungsaufträge | One row per provider with assigned/used/available; inline edit |
| Q6 | P11, P12 | Budget › Sankey and Analyse | No upward flows, "Nicht kategorisiert" at the bottom; donut fills its card |
| Q7 | P10, P13, P14 | Watchlist, Budgets (empty), Versicherung | Reference-like watchlist tabs and empty state; one budget card; insurance suggestions |
| Q8 | all | Layout guard, hydration, Sankey hover e2e | Green at 375/768/1440 |
