# Quickstart & Validation: Investment Analysis, Dividends, Taxes and Watchlists

Setup, dev server and quality gates are unchanged from [001 quickstart](../001-wealth-tracker-dashboard/quickstart.md): `pnpm dev:local` (web 3100, API 3101), demo data via `pnpm --filter api db:seed -- --demo`, gates `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

New migration `0005_investment_analysis` applies on API start. The demo seed adds classifications for the demo ETFs, one custom grouping, inflation rates, one expected dividend, a tax year with base rate and one exemption order, one benchmark with prices, and one watchlist.

## Validation scenarios

| # | Story | Steps | Expected |
|---|---|---|---|
| W1 | US1 | Investments › Analyse › Regionen | Buckets add up to the depot value to the cent; unclassified share shows as "Nicht zugeordnet" |
| W2 | US1 | Open an ETF › Klassifizierung › enter 70 % + 40 % regions › Speichern | Rejected: "Summe 110 %" |
| W3 | US1 | Rendite › Heatmap, 5J | Each year's total equals the yearly table; yearly IZF equals the KPI card for that year (± 0,01 pp) |
| W4 | US1 | Portfoliovergleich with two depots | Both lines start at 0 % on the first common day |
| W5 | US1 | Eigene Aufteilung "Kern/Satellit" › assign 2 instruments | Split shows both groups plus "Nicht zugeordnet" |
| W6 | US2 | Investments › Dividenden | Letzte 12 Monate = Σ dividend transactions of the window; Ø pro Monat = that / 12 |
| W7 | US2 | Add expected dividend next month | Calendar shows "erwartet" with shares × amount per share |
| W8 | US3 | Transaktionen › Typ Verkauf, hide "Steuern", Export | CSV rows and columns equal the visible table; footer total = Σ Gesamtbetrag |
| W9 | US3 | Transaktionen at 360 px | Card layout, no horizontal scroll |
| W10 | US4 | Steuern 2026 › orders 800 € + 300 €, single | Warning "Sparerpauschbetrag überschritten"; used/remaining per broker as in [contracts](./contracts/http-api.md) |
| W11 | US4 | Vorabpauschale 2026 | Matches `apps/api/test/fixtures/vorabpauschale-reference.json` cases; missing base rate shows "Basiszins fehlt" |
| W12 | US5 | Upload a "Kursliste" CSV for a benchmark ISIN › Vermögen chart › Rendite › Vergleichen mit | Second line + legend; end value = price change of the period; choice kept after reload |
| W13 | US6 | Watchlist › add invalid ISIN, then a valid one with prices | Invalid rejected; valid row shows price, date and change for 1W–All-time |
| W14 | US7 | Budget › Analyse › hover a slice | Matching list row highlights; % slices add up to 100 % (± 0,1) |
| W15 | All | `pnpm test:e2e` incl. `responsive.spec.ts` with the new pages | No overflow at 360 px, no "NaN", dark and light |
| W16 | Perf | `pnpm --filter api perf` | New endpoints under the SC-005 limit with 5 years / 10k bookings |

## Performance results (T079)

`pnpm --filter api perf` now also seeds region/sector weights, quarterly dividends, tax years and a benchmark, and times the API calls of every new page one after another (SC-005: each page < 2 s). Measured 2026-11-23 on the development machine, two runs:

| Page | API time |
|---|---|
| Analyse (6 calls: 3 breakdowns incl. volatility, returns ALL, compare, groupings) | 222 / 271 ms |
| Dividenden (3 calls) | 16 / 16 ms |
| Steuern (3 calls incl. Vorabpauschale) | 25 / 32 ms |
| Transaktionen (3 calls) | 9 / 8 ms |
| Watchlists (3 calls) | 3 / 4 ms |
| Übersicht (001, 10 calls) | 153 / 163 ms |
| CSV import 50,000 rows (001) | 20.2 / 23.0 s (target < 30 s) |

The 001 numbers are about twice the T075 values (86 ms, 11.6 s) while their code paths did not change; both runs had the dev server and browser running, so the difference is attributed to machine load. All targets pass.

## Local test results (T082, 2026-11-23)

| Scenario | How | Result |
|---|---|---|
| W1–W5 | Playwright `us7-analysis`, API `analysis.e2e-spec`, unit `breakdown`/`volatility`/`period-returns` | pass |
| W6–W7 | Playwright `us8-dividends`, API `dividends.e2e-spec`, unit `dividends` | pass |
| W8–W9 | Playwright `us9-bookings` (desktop + phone), API `investments-transactions.e2e-spec` | pass |
| W10–W11 | Playwright `us10-taxes`, API `taxes.e2e-spec`, unit `vorabpauschale` (3 reference cases) / `exemption` | pass |
| W12 | Playwright `us11-benchmark`, API `benchmarks.e2e-spec` + `import-prices.e2e-spec` (Kursliste) | pass |
| W13 | Playwright `us12-watchlists`, API `watchlists.e2e-spec` | pass |
| W14 | Playwright `us13-budget-pie`, component `budget-pie` | pass |
| W15 | Playwright `responsive` (19 pages incl. the new ones, 360/768/1280 px, dark + light) | pass |
| W16 | `pnpm --filter api perf` | pass (see Performance results) |

Gates: `pnpm lint` 0 errors (3 existing warnings), `pnpm typecheck` clean, Vitest 324 passed (shared 12, web 33, api 279), Playwright 47 passed, 26 skipped (desktop-only journeys on the mobile project and vice versa).

Fixed during the run: the Datenquellen header overflowed by 69 px at 360 px after the Inflation button was added; it wraps now.

## Feature 001 remains open

Not part of this feature, still tracked in [001 tasks](../001-wealth-tracker-dashboard/tasks.md): US3 Scalable sync (T054–T058, needs the owner's Scalable login) and the deployment (T079–T083, each server step only with the owner's OK).
