# Data Model: Reference Parity

Migration `0006_reference_parity`. Additive only: new tables plus `ALTER TABLE ADD`. No table rebuilds.

## New tables

### tag

| Column | Type | Rules |
|---|---|---|
| id | text PK | uuid |
| name | text | not null, unique (case-insensitive via `lower(name)` unique index), 1–40 chars |
| color | text | palette key, default `neutral` |
| created_at | text | ISO timestamp |

### transaction_tag

| Column | Type | Rules |
|---|---|---|
| transaction_id | text | FK → transactions.id, on delete cascade |
| tag_id | text | FK → tag.id, on delete cascade |

- Primary key `(transaction_id, tag_id)`.
- Index on `tag_id`.

### deleted_import_marker

| Column | Type | Rules |
|---|---|---|
| id | text PK | uuid |
| source | text | transaction source (csv, scalable, …) |
| fingerprint | text | not null |
| source_ref | text | nullable |
| deleted_at | text | ISO timestamp |

- Unique index on `(source, fingerprint)`.
- The import pipeline skips any row whose fingerprint or `(source, source_ref)` matches a marker; it counts as skipped in the import report.

## Changed tables

### transactions

- New index `(booking_date, id)` for the default sort.
- Deletes are real deletes; undo keeps a copy in memory for 10 s (R2), so no read path changes.

### category

- `+ icon text NOT NULL DEFAULT 'tag'`.
- The icon key must be in `CATEGORY_ICONS` (shared). The API validates it, and there is no SQL CHECK, so the list can grow.

## Derived (not stored)

| Name | Source | Shape |
|---|---|---|
| Account sparkline | `net_worth_snapshot` per account, last 30 days | `number[]` cents, ≥ 2 points (flat line if fewer) |
| Last update | max(`import_job.finished_at`) per account, or the source sync time | ISO or null |
| Masked IBAN | `account.iban` | `DE12 •••• •••• 3456` |
| Budget history | budgets × monthly spending per category (incl. sub categories) | 12 months, `budgetCents` null before `created_at` month |
| Trailing returns | snapshots + cash flows | per period: IZF, inflation, real |
| Dividend split | dividends × instrument weights (002) | buckets with cents and share |

## State transitions

```text
transaction: stored ──delete──▶ removed (copy in undo store, 10 s) ──(10 s)──▶ gone
                  ▲                         │
                  └─────────restore─────────┘
imported + deleted ⇒ deleted_import_marker (import skips; restore removes it)
review_status: unreviewed ──(set category | mark reviewed | bulk)──▶ reviewed
```

## Validation rules

- Bulk requests: either `ids` (1–1000) or `filter`, never both. An empty match returns 200 with `affected: 0`.
- `pageSize` 1–200 (the UI offers 25, 50, 100). `sort` comes from a whitelist. `dir` ∈ {asc, desc}.
- Search `q`: 2–100 chars, trimmed.
- Tag names are unique (case-insensitive). Deleting a tag removes its links only.
