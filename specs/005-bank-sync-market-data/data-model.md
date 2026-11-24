# Data Model: Bank Sync and Market Data (005)

Migration `0008_bank_sync_market_data`.

## Enum changes (`packages/shared/src/enums.ts`)

- `SOURCE_KINDS` + `'enable_banking'`. The unused `sparkasse_fints` slot stays in the enum for existing rows but is removed from the source registry.
- `SOURCE_STATUSES` + `'consent_expired'`.
- `TRANSACTION_SOURCES` + `'enable_banking'`.

## New table `bank_consent`

| Column | Type | Rules |
|---|---|---|
| `source_id` | text PK → `data_source.id` | one consent per source |
| `aspsp_name` | text | bank name as listed by Enable Banking |
| `aspsp_country` | text | `DE` |
| `valid_until` | text (ISO date-time) | from session |
| `created_at` | text | default now |

The session id is **not** a column: it is stored AES-GCM encrypted in `data_source.encrypted_credentials` together with the approved account uids.

**State transitions** (`data_source.status`): `planned` → `active` (session created) → `consent_expired` (valid_until passed or 401) → `active` (renewed) | `disabled` (Trennen; credentials and `bank_consent` row deleted, accounts and bookings kept).

## `account` changes

- `external_ref` already exists (004). Bank accounts use `eb:<masked-iban>`; when an existing CSV account has the same IBAN, it is linked (sets `source_id`) instead of created.

## `transaction` (unchanged columns)

- `source = 'enable_banking'`, `source_ref = entry_reference`. Linking a CSV row (R2) sets these two columns; the fingerprint stays.

## `instrument_value_snapshot` change

| Column | Type | Rules |
|---|---|---|
| `flow_cents` | integer not null default 0 | net buy (+) minus sell (−) amount on that day for that instrument |

Recomputed by `RecomputeService`; existing rows are filled by the next recompute (run once in the migration step of the app start).

## New table `quote`

| Column | Type | Rules |
|---|---|---|
| `instrument_id` | text PK → `instrument.id` (cascade) | |
| `price` | text | decimal string, > 0, EUR |
| `change_abs` | text | decimal string, may be negative |
| `change_pct` | text | decimal string |
| `quoted_at` | text (ISO) | time from the provider |
| `fetched_at` | text (ISO) | |

## `price` (unchanged)

Daily closes from `get_security_chart` are upserted with `source = 'scalable'`.

## Derived (not stored)

- **ClassSeriesPoint**: `{ date, assetClass, valueCents, twrorPct }` — from `instrument_value_snapshot` grouped by `instrument.asset_class`.
- **GainSplit**: `{ totalGainCents, realizedCents, priceGainCents }` — `realized + price = total`.
