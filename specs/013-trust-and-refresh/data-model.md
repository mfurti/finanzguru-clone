# Data Model: 013

| Table | Change | Rule |
|---|---|---|
| `institution` | `is_demo` integer (boolean), default 0 | set by the demo seed; migration marks "Demo Broker", "Demo Bank" |
| `account` | `source_balance_cents` integer, nullable | balance reported by the source (cents) |
| `account` | `source_balance_date` text (ISO time), nullable | when that balance was reported |
| `account` | `balance_diff_cents` integer, nullable (migration 0014) | reported − (previous reported + bookings imported since); null until a second sync |

Derived: **Source state** `{ source: 'bank' \| 'broker' \| 'quotes', name, lastSuccessAt, lastError }`; **Balance check** `{ appCents, sourceCents, date, differenceCents }`.
