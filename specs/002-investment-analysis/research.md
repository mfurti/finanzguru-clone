# Research: Investment Analysis, Dividends, Taxes and Watchlists

All decisions build on feature 001 (`specs/001-wealth-tracker-dashboard/research.md`, R1–R18). No new runtime dependencies are needed.

## R1 – Instrument classification storage

- **Decision**: One table `instrument_weight (instrument_id, dimension, key, weight)` with `dimension ∈ {region, sector, currency}` and `weight` as a decimal string (0 < w ≤ 1). Keys come from fixed lists in `packages/shared` (regions: Nordamerika, Europa, Japan, Pazifik ex Japan, Schwellenländer, Sonstige; sectors: the 11 GICS sectors; currencies: ISO 4217 codes). The API rejects a dimension whose weights sum to more than 1.
- **Rationale**: One row per share keeps sums and edits simple and avoids JSON columns that SQLite cannot validate. Fixed key lists keep charts and colors stable.
- **Defaults**: No weights for currency → 100 % `instrument.currency`. No weights for region/sector → "Nicht zugeordnet". Cash → asset class "Cash", currency EUR, region/sector "Nicht zugeordnet".
- **Alternatives**: Free-text keys (typos split buckets); country-level weights (too much manual work for the owner); external look-through data (out of scope, needs a provider).

## R2 – Breakdown computation

- **Decision**: `AnalysisService.breakdown(dimension, accounts)` takes the open positions with current values from the existing `PortfolioService`, multiplies each value by its weights, and rounds per bucket with the largest-remainder method so buckets sum to the total exactly (SC-001). Custom groupings use membership instead of weights (weight 1).
- **Rationale**: Reuses the valuation already proven in 001 (allocation = snapshots to the cent).
- **Alternatives**: Per-row rounding (sum drifts by cents).

## R3 – Volatility

- **Decision**: Annualized standard deviation of daily log returns from `price` over the last 365 days, `σ × √252`, only when ≥ 60 price points exist. Classes: < 10 % niedrig, 10–20 % mittel, > 20 % hoch. Computed in `domain/volatility.ts` with decimal.js for the mean/variance and `Math.sqrt` on the final value (precision is not money-critical).
- **Alternatives**: Weekly returns (too few points for young positions), portfolio-level volatility only (does not split the portfolio).

## R4 – Monthly heatmap and yearly bars

- **Decision**: Monthly TWROR from the existing daily depot series (`OverviewService.dailyTotals` with external flows) using the 001 formula `r = V_t/(V_{t-1}+F_t) − 1`, chain-linked per calendar month. Yearly value = product of its months. The heatmap is a plain CSS grid table (months × years) with a diverging color scale and the value as text, not a chart library component.
- **Rationale**: Same math as the KPI card, so the totals agree (SC-002). Unovis has no heatmap; a table is accessible and responsive.

## R5 – Yearly IZF, inflation, real return

- **Decision**: Per year, `xirr(periodCashFlows(series of that year))` from `domain/returns.ts`; the current year as YTD. New table `inflation_rate (year, rate)`; the existing `owner.inflation_rate` is the fallback for years without an entry. Real return via the existing `realReturn()`.
- **Alternatives**: Fetching inflation from Destatis (external call, against FR-023).

## R6 – Portfolio comparison

- **Decision**: `net_worth_snapshot` is stored per account, so each depot's TWROR series comes from its own rows. All selected series are rebased to 0 % on the first day that all selected depots have a value.

## R7 – Dividends

- **Decision**: Received dividends = transactions of type `dividend` (net `amount_cents`, which already excludes withheld tax). Yield YTD = dividends YTD / average daily depot value YTD. CAGR = (last full year / first full year)^(1/(n−1)) − 1 over full years with income > 0; fewer than 2 such years → `null`. Expected payments in `expected_dividend`; expected amount = quantity held on the pay date (FIFO positions replayed to that date) × amount per share. A received dividend for the same instrument and month marks the expected one as received.

## R8 – Exemption orders and taxable income

- **Decision**: Tables `exemption_order (institution_id, year, amount_cents)` and `tax_year (year, assessment, base_rate)`. Taxable income per institution and year = dividends (gross = net + tax) + interest + realized gains (from `summarize()` realized gross) − fees of that institution's accounts. Used = min(order, max(0, taxable income)). Withheld tax on a booking means income above the order was taxed; the view shows it but does not change transactions. Warning when Σ orders > allowance (1.000 € single, 2.000 € joint).
- **Rationale**: All inputs are already recorded per account; institution links accounts to brokers.

## R9 – Vorabpauschale estimate

- **Decision**: `domain/vorabpauschale.ts`, pure and decimal-based, per fund instrument (asset class `etf` or `fund`) and year:
  1. Basisertrag = units at 1 Jan × price at the last trading day of the previous year × base rate × 0,7. Units bought during the year use the same start price, reduced by 1/12 for each full month before purchase.
  2. Limit to the actual gain: (end price − start price) × units + distributions in the year, minimum 0. For the current year, end price = latest price.
  3. Vorabpauschale = max(0, Basisertrag − distributions).
  4. Taxable part = Vorabpauschale × (1 − Teilfreistellung): Aktienfonds 30 %, Mischfonds 15 %, sonstiger Fonds 0 %; new column `instrument.fund_type` (default Aktienfonds for `etf`).
  Missing base rate → result `null` with reason `base_rate_missing`. Three reference cases go into `apps/api/test/fixtures/vorabpauschale-reference.json` (SC-004).
- **Alternatives**: Per-lot calculation (same result for this estimate, more code).

## R10 – Price import for benchmarks and watchlists

- **Decision**: Add a "Kursliste" CSV format to the existing CSV pipeline: columns `Datum;Schlusskurs` (optional `ISIN`); if no ISIN column exists, the owner picks the instrument. Prices are stored with `source = 'csv'` and upserted by `(instrument_id, date)`. Manual entry uses `POST /api/instruments/:id/prices`. Instruments for benchmarks and watchlists are created by ISIN + name (no position needed). Detection reuses `detector.ts`.
- **Rationale**: 001 has no stand-alone price import; benchmarks and watchlists need prices for instruments the owner does not hold.

## R11 – Benchmark line and chart preferences

- **Decision**: `instrument.is_benchmark` flag. Benchmark return = close_t / close_t0 − 1 with carry-forward (001 rule, stale after 4 days). The selected benchmark per chart is stored in a key/value table `user_setting (key, value)` with keys `chart.networth.benchmark` and `chart.investments.benchmark`. The net-worth chart shows the benchmark only in Rendite mode, the investment chart in % mode.

## R12 – Bookings table

- **Decision**: Extend `GET /api/investments/transactions` with `instrumentId`, `sort`, `dir`, plus a `transactions.csv` export with the same filters and a `columns` list. Frontend: `UTable` with column visibility (same pattern as `PositionsTable.vue`), server-side paging (50 per page), and a card layout below `sm` for the 360 px rule. The footer total sums the filtered rows on the server.

## R13 – Budget pie chart

- **Decision**: Frontend only. `VisDonut` on the data the category list already loads (`/api/cashflow/categories`), €/% toggle, and a shared `hoveredCategoryId` ref between donut and list (slice hover via Unovis events, row hover via `mouseenter`). Reuses the `.chart-hover` styles from the animation polish.

## R14 – Navigation

- **Decision**: `InvestmentsNav.vue` gets six entries (Positionen, Transaktionen, Analyse, Dividenden, Steuern, Watchlists), horizontally scrollable on phones like the main tabs.

## R15 – Testing

- **Decision**: Domain functions (breakdown rounding, volatility, monthly TWROR, dividend CAGR, exemption usage, Vorabpauschale) get Vitest unit tests with fixtures; each new controller gets a Nest e2e test with `inject()`; each user story gets one Playwright journey; `responsive.spec.ts` gets the new pages. The perf script from T075 adds the new endpoints (SC-005).
