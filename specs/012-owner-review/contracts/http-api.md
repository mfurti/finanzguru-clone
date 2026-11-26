# HTTP API changes (012)

| Endpoint | Change |
|---|---|
| `GET /api/investments/dividends/summary` (existing) | adds `portfolioValueCents`, `yearCents`, `byCurrency[]` |
| `GET /api/taxes/exemption-providers?year=` (new) | `[{ institutionId, name, logo, year, assignedCents, usedCents, availableCents }]` |
| `PUT /api/taxes/exemption-orders` (existing) | unchanged; used for inline edit of assigned amount |
| `GET /api/insurance/suggestions` (new) | `[{ key, counterparty, amountCents, interval, type, count, lastDate }]` |
| `POST /api/insurance/suggestions/:key/dismiss` (new) | 204; stores the dismissal |
| `POST /api/insurance` (existing) | used to accept a suggestion |

All amounts integer cents; errors `{ statusCode, statusMessage }` as today.
