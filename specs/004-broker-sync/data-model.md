# Data Model: Broker Sync and Open Follow-ups

Migration `0007_sync_and_history`. It is additive only: `CREATE TABLE` and `CREATE INDEX`.

## New tables

### sync_run

| Column | Type | Rules |
|---|---|---|
| id | text PK | uuid |
| source_id | text | FK → data_source.id, on delete cascade |
| started_at | text | ISO timestamp, not null |
| finished_at | text | nullable while running |
| status | text | `running` \| `succeeded` \| `partial` \| `failed` |
| imported | integer | ≥ 0 |
| skipped | integer | ≥ 0 |
| error | text | nullable, ≤ 500 chars, never contains tokens |

Index `(source_id, started_at)`.

### instrument_value_snapshot (derived, rebuildable)

| Column | Type | Rules |
|---|---|---|
| account_id | text | FK → account.id (depot), on delete cascade |
| instrument_id | text | FK → instrument.id, on delete cascade |
| date | text | YYYY-MM-DD |
| value_cents | integer | quantity × last known close |
| invested_cents | integer | open cost basis (FIFO, 001 R9) |

- Primary key `(account_id, instrument_id, date)`.
- Index `(instrument_id, date)`.
- Rebuilt together with `net_worth_snapshot` by `RecomputeService`.
- For every depot and day, Σ over instruments = the depot snapshot's value, ±1 cent from rounding.

## Changed tables

- `data_source`: unchanged schema. Status transitions:

```text
planned ──connect──▶ active ──grant expired──▶ needs_reauth ──reconnect──▶ active
active ──upstream error──▶ error ──next good sync──▶ active
any ──disconnect──▶ disabled (grant deleted, data kept)
```

- `account.last_synced_at`: set at the end of a successful sync. 003 shows it as "Zuletzt …".
