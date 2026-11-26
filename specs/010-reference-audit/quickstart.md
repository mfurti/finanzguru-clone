# Quickstart: Figures, Calculations and Layout Checked Against the Reference (010)

Local only (web 3100, API 3101). Gates: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

Owner amounts go only into `apps/api/data/audit-010-local.md` (git-ignored); this file records status only.

| # | Story | Steps | Expected |
|---|---|---|---|
| Q1 | US1 | Owner's real accounts selected; compare Übersicht, Kennzahlen (1 J), Positionen, Einnahmen & Ausgaben (current month) with the reference; run `pnpm --filter api audit:figures -- --accounts <ids>` | A1–A15 within ±1 € (quote differences aside); remaining differences explained |
| Q2 | US1 | Investments value chart 1 J | No single-day drop |
| Q3 | US2 | Current month, Ausgaben by category | ≤ 5 "Nicht kategorisiert" |
| Q4 | US3 | Transaktionen at 375 / 768 / 1440 px | Phone: date-grouped list, amount visible; tablet: Name, Datum, Kategorie, Betrag fit; desktop unchanged |
| Q5 | US3 | Positionen, Buchungen, Steuern at 375 / 768 / 1440 px | Fit at 1440; sticky first column when scrolling |
| Q6 | US4 | Any page | One dropdown height; figure boxes framed in dark and light; Analyse five figures in one row ≥ 1280 px |
