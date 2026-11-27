# Data Model: 013

| Table | Change | Rule |
|---|---|---|
| `institution` | `is_demo` integer (boolean), default 0 | set by the demo seed; migration marks "Demo Broker", "Demo Bank" |
| `account` | `source_balance_cents` integer, nullable | balance reported by the source (cents) |
| `account` | `source_balance_date` text (ISO date), nullable | date of that balance |

Derived: **Source state** `{ source: 'bank' \| 'broker' \| 'quotes', name, lastSuccessAt, lastError }`; **Balance check** `{ appCents, sourceCents, date, differenceCents }`.
