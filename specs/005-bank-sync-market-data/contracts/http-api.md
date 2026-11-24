# HTTP API: Bank Sync and Market Data (005)

All routes need the owner session cookie. DTOs live in `packages/shared/src/schemas/`. No response contains tokens, session ids, keys or `encrypted*` fields.

## Bank (sources)

| Method | Path | Result |
|---|---|---|
| GET | `/api/sources/bank/institutions?country=DE` | `{ name, country, logo? }[]` (from `GET /aspsps`) |
| POST | `/api/sources/bank/connect` body `{ aspspName, aspspCountry }` | `{ authorizationUrl }` |
| GET | `/api/sources/bank/callback?code&state` | 302 → `/settings/sources?connected=bank`; errors → `?error=bank&reason=denied\|state\|expired` |
| POST | `/api/sources/enable_banking/sync` | 202 `{ runId }` (existing route from 004) |
| DELETE | `/api/sources/enable_banking` | 204; deletes the session at Enable Banking and locally |

`GET /api/sources` (existing) adds for the bank source: `consentEndsAt: string \| null`, `consentWarning: boolean` (≤ 14 days), `institution: string \| null`, `accounts: { id, name, maskedIban }[]`.

Daily sync is switched by the env flag `BANK_DAILY_SYNC` (default off), like `SCALABLE_DAILY_SYNC` in 004; `dailySync` is reported in `GET /api/sources`.

## Investments

| Method | Path | Result |
|---|---|---|
| GET | `/api/investments/performance/classes?from&to` | `{ classes: AssetClass[], series: { date, total: { valueCents, twrorPct }, byClass: Record<AssetClass, { valueCents, twrorPct }> }[] }` |
| GET | `/api/investments/instruments/:id` (existing) | adds `gain: { totalGainCents, realizedCents, priceGainCents }` |

`twrorPct` is a decimal string with 4 places; `null` before the first holding of that class.

## Market data

| Method | Path | Result |
|---|---|---|
| GET | `/api/market-data/search?q&class` | `{ available: boolean, groups: { assetClass, hits: { isin, wkn?, name, assetClass }[], more: boolean }[] }`; `q` ≥ 2 chars, else 400 |
| POST | `/api/watchlists/:id/entries` (existing, extended) body `{ instrumentId }` or `{ isin, name, assetClass }` | 201; creates the instrument if unknown; 409 if already on the list |
| GET | `/api/market-data/quotes?ids=…` | `{ instrumentId, price, changeAbs, changePct, quotedAt }[]` |
| POST | `/api/market-data/refresh` | 202; refreshes quotes for watchlist and held instruments |
| GET | `/api/market-data/chart/:instrumentId?range=1M\|6M\|1Y\|5Y` | `{ date, close }[]` |

Without an active Scalable source: search returns `{ available: false, groups: [] }`; refresh returns 409.
