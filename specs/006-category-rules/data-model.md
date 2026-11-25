# Data Model: Category Rules That Learn (006)

Migration `0009_rule_suggestions`.

## Existing `categorization_rule` (unchanged)

`priority` (unique, ascending), `match_field` (`counterparty` | `purpose` | `counterparty_iban`), `operator` (`contains` | `equals` | `starts_with` | `regex`), `pattern` (regex must compile), `amount_sign` (`positive` | `negative` | null), `category_id`, `enabled`.

## New `rule_suggestion`

| Column | Type | Rules |
|---|---|---|
| `id` | text PK (UUIDv7) | |
| `counterparty_key` | text not null | normalized counterparty, 1–200 chars |
| `category_id` | text not null → `category.id` (cascade) | |
| `count` | integer not null default 0 | ≥ 0 |
| `status` | text not null default `open` | `open`, `accepted`, `declined` |
| `updated_at` | text not null default now | |

Unique `(counterparty_key, category_id)`.

**State transitions**: `open` → `accepted` (accept, or rule saved via "merken") | `declined` (decline; final).

## `transaction` (unchanged columns)

`category_source`: `manual` (owner, incl. "all bookings of this recipient"), `rule` (rule applied), `import`, null.
