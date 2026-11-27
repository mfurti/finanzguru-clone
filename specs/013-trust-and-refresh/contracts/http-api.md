# HTTP API changes (013)

| Endpoint | Change |
|---|---|
| `DELETE /api/demo` (new) | removes all demo data; 200 `{ removed: { institutions, accounts, transactions, … } }`; 404 when none |
| `POST /api/sources/refresh-all` (new) | `[{ source, name, ok, at, error }]` |
| `GET /api/sources/state` (new) | `{ oldestSuccessAt, outdated, sources: [{ source, name, lastSuccessAt, lastError }] }` |
| `GET /api/accounts/overview` (existing) | rows add `balanceCheck: { sourceCents, at, differenceCents } \| null` – difference of the reported balance to previous source balance + bookings imported since |

Errors `{ statusCode, statusMessage }` as today.
