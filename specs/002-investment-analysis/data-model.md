# Data Model: Investment Analysis, Dividends, Taxes and Watchlists

Extends the 001 model (`specs/001-wealth-tracker-dashboard/data-model.md`). One migration (`0005_investment_analysis.sql`). Money in integer cents, rates and weights as decimal strings, dates as ISO `YYYY-MM-DD`, ids as UUIDv7 text (same conventions as 001).

## Changed: instrument

| Field | Type | Rules |
|---|---|---|
| fund_type | text, nullable | `equity` \| `mixed` \| `other`; default `equity` when asset class is `etf` or `fund`, else null |
| is_benchmark | integer (bool) | default 0; selectable in "Vergleichen mit" |

## New: instrument_weight

| Field | Type | Rules |
|---|---|---|
| instrument_id | text FK → instrument (cascade) | |
| dimension | text | `region` \| `sector` \| `currency` |
| key | text | from the fixed key list of the dimension (`packages/shared`) |
| weight | text | decimal, 0 < w ≤ 1 |

PK `(instrument_id, dimension, key)`. The API rejects a save if Σ weight of one dimension > 1 (message names the sum). The remainder up to 1 counts as "Nicht zugeordnet".

## New: custom_grouping, custom_group, custom_group_member

| Table | Fields | Rules |
|---|---|---|
| custom_grouping | id, name (1–60, unique) | |
| custom_group | id, grouping_id FK (cascade), name (1–60), position | unique `(grouping_id, name)` |
| custom_group_member | grouping_id FK (cascade), group_id FK (cascade), instrument_id FK (cascade) | PK `(grouping_id, instrument_id)`: one group per grouping |

## New: inflation_rate

| Field | Type | Rules |
|---|---|---|
| year | integer PK | 1990–2100 |
| rate | text | decimal −0.1 … 0.5 |

Fallback: `owner.inflation_rate` when a year has no row.

## New: expected_dividend

| Field | Type | Rules |
|---|---|---|
| id | text PK | |
| instrument_id | text FK → instrument (cascade) | |
| pay_date | text | ISO date |
| ex_date | text, nullable | ≤ pay_date |
| amount_per_share | text | decimal > 0, EUR |
| note | text, nullable | ≤ 200 |

Derived (not stored): `status = received` if a `dividend` transaction for the instrument exists in the same month, else `expected`; `expectedCents = quantity held on pay_date × amount_per_share`.

## New: tax_year

| Field | Type | Rules |
|---|---|---|
| year | integer PK | |
| assessment | text | `single` \| `joint` (allowance 100000 / 200000 cents) |
| base_rate | text, nullable | decimal 0 … 0.2 (Basiszins) |

## New: exemption_order

| Field | Type | Rules |
|---|---|---|
| id | text PK | |
| institution_id | text FK → institution (cascade) | |
| year | integer | |
| amount_cents | integer | ≥ 0 |

Unique `(institution_id, year)`. Derived: `usedCents`, `remainingCents` (R8).

## New: watchlist, watchlist_entry

| Table | Fields | Rules |
|---|---|---|
| watchlist | id, name (1–60, unique), position | |
| watchlist_entry | watchlist_id FK (cascade), instrument_id FK (cascade), position, added_at | PK `(watchlist_id, instrument_id)` |

## New: user_setting

| Field | Type | Rules |
|---|---|---|
| key | text PK | allowlist: `chart.networth.benchmark`, `chart.investments.benchmark` |
| value | text, nullable | instrument id or null |

## Changed: price (no schema change)

Prices from the new "Kursliste" CSV use `source = 'csv'`; manual prices `source = 'manual'`. Upsert by PK `(instrument_id, date)`.

## Derived views (no tables)

- **Breakdown bucket**: `{ key, label, valueCents, pct, count }`, Σ valueCents = total depot value (largest-remainder rounding).
- **Monthly return**: `{ year, month, twror }`; **yearly row**: `{ year, twror, xirr, inflation, realReturn, ytd }`.
- **Dividend summary**: `{ last12Cents, avgPerMonthCents, yieldYtd, cagr, years: [{ year, cents, changePct }], bySecurity: [...] }`.
- **Vorabpauschale row**: `{ instrumentId, year, basisertragCents, vorabpauschaleCents, taxableCents, reason? }`.
