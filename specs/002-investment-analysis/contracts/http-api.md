# HTTP API additions (feature 002)

Same conventions as `specs/001-wealth-tracker-dashboard/contracts/http-api.md`: prefix `/api`, session cookie required, JSON, money in cents, decimals as strings, `accounts` = comma-separated depot ids (empty = all), errors `{ statusCode, statusMessage, data? }`, validation errors 400 with `data.issues`.

## Analyse (US1)

| Method | Path | Body / Response |
|---|---|---|
| GET | `/api/analysis/breakdown?dimension=assetClass\|region\|sector\|currency\|volatility\|return\|grouping&groupingId&accounts` | `{ totalCents, buckets: [{ key, label, valueCents, pct, count }] }` |
| GET | `/api/analysis/returns?period&accounts` | `{ series: [{ date, twror }], months: [{ year, month, twror }], years: [{ year, twror, xirr, inflation, realReturn, ytd }] }` |
| GET | `/api/analysis/compare?accounts=a,b&period` | `{ series: [{ accountId, name, points: [{ date, twror }] }] }` |
| GET | `/api/instruments/:id/classification` | `{ fundType, isBenchmark, weights: { region: [{ key, weight }], sector: [...], currency: [...] } }` |
| PUT | `/api/instruments/:id/classification` | same shape → 200; 400 if a dimension sums > 1 |
| GET/POST | `/api/groupings` | list / create `{ name, groups: [name] }` |
| PATCH/DELETE | `/api/groupings/:id` | rename, edit groups / delete |
| PUT | `/api/groupings/:id/members` | `{ members: [{ instrumentId, groupId \| null }] }` |
| GET/PUT | `/api/settings/inflation` | `[{ year, rate }]` (PUT replaces the list) |

## Dividenden (US2)

| Method | Path | Body / Response |
|---|---|---|
| GET | `/api/dividends/summary?accounts&year` | dividend summary (data-model "Derived views") |
| GET | `/api/dividends/calendar?from&to&accounts` | `[{ date, instrumentId, name, status: expected\|received, cents, amountPerShare? }]` |
| POST | `/api/dividends/expected` | `{ instrumentId, payDate, exDate?, amountPerShare, note? }` → 201 |
| PATCH/DELETE | `/api/dividends/expected/:id` | |

## Buchungen (US3)

| Method | Path | Body / Response |
|---|---|---|
| GET | `/api/investments/transactions?accounts&type&from&to&instrumentId&sort=date\|amount&dir=asc\|desc&page&pageSize` | `{ items: [{ id, bookingDate, type, instrumentId, name, wkn, isin, accountId, accountName, unitPrice, quantity, taxCents, feeCents, amountCents }], total, sumCents }` (extends 001) |
| GET | `/api/investments/transactions.csv?…same&columns=date,type,…` | `text/csv; charset=utf-8` with BOM, `;`, de-DE decimals |

## Steuern (US4)

| Method | Path | Body / Response |
|---|---|---|
| GET | `/api/taxes/:year` | `{ year, assessment, allowanceCents, baseRate, orders: [{ id, institutionId, institutionName, amountCents, usedCents, remainingCents, taxableIncomeCents }], totalCents, exceedsAllowance }` |
| PUT | `/api/taxes/:year` | `{ assessment, baseRate? }` |
| POST | `/api/taxes/:year/orders` | `{ institutionId, amountCents }` → 201 (409 if one exists for the institution) |
| PATCH/DELETE | `/api/taxes/orders/:id` | |
| GET | `/api/taxes/:year/vorabpauschale?accounts` | `{ year, baseRate, rows: [{ instrumentId, name, fundType, basisertragCents, vorabpauschaleCents, taxableCents, reason? }], totalTaxableCents, estimate: true }` |

## Vergleichen mit (US5)

| Method | Path | Body / Response |
|---|---|---|
| GET | `/api/benchmarks` | `[{ instrumentId, name, isin, firstDate, lastDate }]` |
| GET | `/api/benchmarks/:instrumentId/series?period` | `{ points: [{ date, return }], stale }` |
| GET/PUT | `/api/settings/charts` | `{ networthBenchmark, investmentsBenchmark }` (instrument ids or null) |

## Kurse und Instrumente (US5, US6)

| Method | Path | Body / Response |
|---|---|---|
| POST | `/api/instruments` | `{ isin, name, assetClass, isBenchmark? }` → 201 (ISIN checksum validated; 409 if exists) |
| POST | `/api/instruments/:id/prices` | `{ prices: [{ date, close }] }` (upsert, manual) |
| POST | `/api/import/csv` | existing upload; new detected format `price-list` (see csv-formats addition below) |

CSV "Kursliste": header `Datum;Schlusskurs` (optional `ISIN`), dates `DD.MM.YYYY` or ISO, decimal comma or point. Without an ISIN column, confirm takes `{ instrumentId }`. Import job counts are `imported` (new prices), `updated`, `skipped`.

## Watchlists (US6)

| Method | Path | Body / Response |
|---|---|---|
| GET/POST | `/api/watchlists` | list `[{ id, name, count }]` / create `{ name }` |
| PATCH/DELETE | `/api/watchlists/:id` | rename / delete |
| GET | `/api/watchlists/:id?period` | `{ id, name, entries: [{ instrumentId, name, isin, priceCents, priceDate, changeCents, changePct, stale, hasPrices }] }` |
| POST | `/api/watchlists/:id/entries` | `{ isin, name }` (creates the instrument if missing) |
| DELETE | `/api/watchlists/:id/entries/:instrumentId` | |

## Budget (US7)

No API change: the pie chart uses `GET /api/cashflow/categories` from 001.
