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

## Status after T017 (2026-11-27)

Layout guard (375 / 768 / 1440 px), hydration check, Sankey hover, Übersicht navigation and donut size e2e green. Layout guard found the provider table scrolling without a fixed first column on phones; fixed (provider column sticky).

## Status after T018 (2026-11-27, no amounts)

| # | Status |
|---|---|
| Q1 | Übersicht keeps its side navigation (e2e); Investments shows "Buchungen" and "Watchlist" |
| Q2 | Transaktionen columns Datum, Kategorie, Tags, Eigenschaften, Betrag, Steuern; Positionen "Spalten" panel with select all, reorder and save, kept after reload |
| Q3 | Kauf green, Verkauf blue badge; filter offers only portfolios in Investments ("Alle Portfolios") |
| Q4 | Yearly dividends equal the reference for the same (real) accounts; the gap came from the demo accounts under "Alle Konten". Cards Investments / Dividendenerträge / Dividendenrendite; Aufteilung › Währungen |
| Q5 | One row per provider (every depot institution), assigned amount edited in place, used with bar, available |
| Q6 | Sankey: no upward flows, categories without sub categories and "Nicht kategorisiert" at the bottom; categories donut 400 px at 1440 px |
| Q7 | Watchlist tabs with default list, header menu, reference empty state; Budgets empty state as one card; insurance suggestions with accept/dismiss |
| Q8 | Layout guard, hydration, Sankey hover green |

Checked in dark and light mode.

## Gates after T019 (2026-11-27)

Lint, format check, typecheck green; unit tests api 542, web 142, shared 12 passed. Full e2e: first run found two tests still using the old Konto column and a click before hydration on the watchlist redirect (fixed); rerun 143 passed, 1 timeout in the CSV import V3 test, which passes on its own (2 of 2) and in the first run – load-related flakiness, unrelated to 012.
