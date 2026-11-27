# HTTP API (014)

| Endpoint | Behaviour |
|---|---|
| `GET /api/settings` | merged OwnerSettings with defaults |
| `PATCH /api/settings` | partial OwnerSettings, validated; returns merged |
| `PATCH /api/accounts/:id` (existing) | adds `archived`, `sortOrder` (existing) |
| `POST /api/accounts/order` | `{ ids: string[] }` sets positions |
| `GET /api/backup` | zip download (db snapshot, logos, manifest) |
| `POST /api/backup/restore` | multipart zip; 202 staged, 400 invalid/newer |
| `GET /api/transactions/export.csv` (existing) | all bookings when no filter |
| `POST /api/auth/password` | `{ current, next }`; 204; 400 wrong current; other sessions ended |
| `GET /api/auth/sessions` | `[{ id, createdAt, lastSeenAt, userAgent, current }]` |
| `DELETE /api/auth/sessions` | ends all other sessions |
| `GET /api/about` | `{ version, databaseBytes, sources }` |

Errors `{ statusCode, statusMessage }`.
