# Data Model: Popups, Tables and Charts Like the Reference (007)

Migration `0010_transaction_note`.

## `transaction` change

| Column | Type | Rules |
|---|---|---|
| `note` | text, nullable | free text of the owner, max 1 000 characters (check), trimmed; empty string stored as null |

Returned in the list item and accepted by `PATCH /api/transactions/:id`. Included in the CSV export only when the column is visible (existing behaviour of 003).

## Filter (no storage)

`direction`: `in` (amount > 0) | `out` (amount < 0); absent = both.

## Browser preference (existing, local)

Visible columns of the Transaktionen table: new default `name, date, category, properties, amount`; stored choices that contain `account` keep it.
