# HTTP API changes (013)

| Endpoint | Change |
|---|---|
| `DELETE /api/demo` (new) | removes all demo data; 200 `{ removed: { institutions, accounts, transactions, … } }`; 404 when none |
| `POST /api/sources/refresh-all` (new) | `[{ source, name, ok, at, error }]` |
| `GET /api/sources/state` (new) | `{ oldestSuccessAt, outdated, sources: [{ source, name, lastSuccessAt, lastError }] }` |
| `GET /api/accounts` (existing) | adds `balanceCheck: { appCents, sourceCents, date, differenceCents } \| null` |

Errors `{ statusCode, statusMessage }` as today.
