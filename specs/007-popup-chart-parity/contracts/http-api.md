# HTTP API: Popups, Tables and Charts Like the Reference (007)

Only small extensions; everything else is web.

| Method | Path | Change |
|---|---|---|
| GET | `/api/transactions` (existing) | items carry `note: string \| null`; query `direction=in\|out` |
| GET | `/api/transactions/export.csv` (existing) | same `direction` filter |
| POST | `/api/transactions/bulk` (existing) | `filter` accepts `direction` |
| PATCH | `/api/transactions/:id` (existing) | body accepts `note: string \| null` (≤ 1 000 chars, trimmed; `''` → null) |

Invalid `direction` → 400; note longer than 1 000 → 400.
