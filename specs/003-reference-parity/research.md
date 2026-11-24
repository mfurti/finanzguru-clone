# Research: Reference Parity

All decisions for feature 003. No open NEEDS CLARIFICATION.

## R1 Transactions query: server-side filter, sort, page

- **Decision**: Extend `GET /transactions` with these query parameters: `q`, `accountIds`, `types`, `categoryIds`, `tagIds`, `from`, `to`, `minCents`, `maxCents`, `review`, `sort`, `dir`, `page`, `pageSize` (25/50/100). It returns `{ items, total, page, pageSize }`.
  - Sorting uses a whitelist of columns: date, amount, counterparty, category, account.
  - Existing indexes cover account+date. A new index on `(booking_date, id)` gives a stable order.
- **Rationale**: 10,000 rows in under 1 s (SC-003) is trivial for SQLite with indexes. A client-side table would ship all rows.
- **Alternatives**: Client-side filtering only (rejected because the payload grows with history). Cursor paging (rejected because the reference uses page numbers and page sizes).

## R2 Bulk actions and delete with undo

- **Decision**: `POST /transactions/bulk` with `{ ids | filter, action: setCategory|addTags|removeTags|markReviewed|delete, value? }`.
  - Delete is a soft delete. The rows move into a `deletedAt` state. `POST /transactions/restore` undoes it.
  - A purge removes soft-deleted rows older than 10 s on the next write and at startup.
  - Imported rows also get a `deleted_import_marker` (source plus fingerprint/sourceRef) so a re-import skips them (FR-007).
- **Rationale**: Undo needs the data on the server. A browser-only delay would lose the delete if the tab closes.
- **Alternatives**: Delay the DELETE in the browser for 10 s (rejected because a reload loses the action silently).

## R3 Global search

- **Decision**: `GET /search?q=` (≥ 2 chars). It returns the top 5 per group: pages (static list from i18n), instruments (name/ISIN/WKN), accounts (name/institution/IBAN), transactions (counterparty/purpose, `LIKE`).
  - The UI is a Nuxt UI `UCommandPalette` in a modal, opened by the header magnifier or Ctrl/Cmd+K, with a 200 ms debounce.
- **Rationale**: `LIKE` over 10,000 rows takes about 10 ms. FTS5 adds migration and trigger complexity for no gain at this scale.
- **Alternatives**: SQLite FTS5 (deferred). Client-side index (rejected because it would download all bookings).

## R4 Tags

- **Decision**: A `tag` table (unique name, color) and a `transaction_tag` join table. CRUD under `/tags`, managed in a "Tags" modal on the transactions page. Filtering uses `tagIds` (any match).
- **Alternatives**: A JSON column on transactions (rejected because it can't be indexed or renamed).

## R5 Review flow moves to Übersicht › Transaktionen

- **Decision**: `pages/budget/review.vue` becomes a redirect to `/transactions?review=unreviewed`.
  - "Alle als geprüft markieren" uses the bulk endpoint with the current filter, after a confirmation that shows the count.
  - Review logic from `transactions-review.service.ts` is reused.

## R6 Accounts overview and detail

- **Decision**: `GET /accounts/overview` returns groups (depot, account) with total and rows. Each row has avatar initials, a masked IBAN (first 4 + last 4), a 30-day sparkline from `net_worth_snapshot`, `lastSyncAt`/`lastImportAt` (from `import_job`) and `canSync` (source supports sync).
  - `GET /accounts/:id/detail` returns the history (period param), key figures (balance, change in period, inflow/outflow) and the bookings via R1 with `accountIds=[id]`. Depots also return positions via the existing investments service with an account filter.
  - Routes: `/accounts/:id` and `/depots/:id`.
  - The copy button copies the full IBAN; the full IBAN is sent only in the detail response and on the copy action, through the row's `iban` field.

## R7 Budget period picker and Sankey page

- **Decision**:
  - `PeriodPicker` extends `PeriodSwitcher` with a "Aktueller Monat" button, a `UPopover` for picking month/quarter/year, and the date range label "01.11. – 30.11.". State lives in the route query (`?period=2026-09`), so all budget pages share it.
  - `pages/budget/sankey.vue` shows `SankeyChart`, with the R1 table below it filtered by period. A click on a node emits its category id and toggles a `categoryIds` filter.

## R8 Category icons

- **Decision**: A new `category.icon` column holding an icon key from a fixed list of about 40 Lucide icons in `packages/shared/src/category-icons.ts`, default `tag`. Demo and default categories get sensible icons. The icon is chosen in Settings › Kategorien.
- **Rationale**: Lucide is already bundled through Nuxt UI (Iconify, served locally). A fixed list keeps the DTO validated.

## R9 One color per category

- **Decision**: The stored `category.color` (existing column) is the single source.
  - The `useCategoryAppearance` composable maps it to a hex value from one shared palette, the pastel set now used in the Sankey, extended to 12.
  - Donut, list, Sankey, bars and detail all use it. Sub categories inherit the main category's color, with lightness steps in the Sankey.
  - Existing `color` values are mapped 1:1 to palette entries, so there is no data migration beyond defaults.

## R10 Avatars

- **Decision**: `Avatar.vue` shows initials (up to 2) on a background picked by a stable hash of the name into the palette from R9. No network logos (FR-025).

## R11 Font Outfit

- **Decision**: Ship `Outfit[wght].woff2` (variable, latin + latin-ext subset, OFL) in `apps/web/public/fonts/`, with `@font-face` (`font-display: swap`) in `main.css`. Set `--font-sans: 'Outfit', Arial, sans-serif` and include the OFL license text next to the file.
- **Alternatives**: @nuxt/fonts with the Google provider (rejected because it fetches from a third party at build or runtime).

## R12 Budgets overview

- **Decision**: `GET /budgets/overview?period=` returns:
  - `rows`: per budget, the limit, spent, status ratio and difference.
  - `total`: the Gesamtbudget row.
  - `series`: 12 months of `{ month, budgetCents | null, spentCents }` per budget and in total. A budget created mid-year gives null for earlier months, which shows as a gap.
  - The chart uses CashflowBars-style grouped bars (budget vs. spent) with a "Gesamtbudget" toggle. Create/edit/delete use a dialog with the existing endpoints.

## R13 Investments refinements

- **Positions**: `USortable` headers through TanStack sorting (already in UTable). Copy buttons for WKN/ISIN. Avatar. The asset filter becomes a legend of chips over the chart, sharing state with the table through `useState('assetClass')`.
- **Buchungen**: `FilterPanel` (popover) with an active count. All columns are sortable through R1-style parameters on `/investments/transactions`.
- **Analyse Zeiträume**: `period-returns.ts` gets `trailingReturns(asOf)` for 1M, 3M, YTD, 1J, 3J, 5J and Gesamt, with IZF, inflation and real return.
- **Dividenden**: `GET /dividends/split?by=security|region|sector` reuses the `breakdown.ts` weighting. The calendar gets a month-grid view, with a list below `sm`.
- **Steuern**: the Vorabpauschale response is grouped by depot institution, with subtotals.

## R14 Testing

- **Per layer**:
  - Domain unit tests: trailing returns, budget history, sparkline, masking.
  - API e2e: query/bulk/restore/marker, tags, search, overviews.
  - Component tests: table, picker, search.
- **Playwright journeys**: one per user story, `e2e/us-p1-…us-p8-*.spec.ts`.
- **Other**:
  - The responsive spec gets the new pages.
  - The perf script adds query and search timings with 10,000 bookings.
  - A network check asserts that no third-party host is requested (SC-007).
