# HTTP API changes (012)

| Endpoint | Change |
|---|---|
| `GET /api/investments/dividends/summary` (existing) | adds `portfolioValueCents`, `yearCents`, `byCurrency[]` |
| `GET /api/taxes/:year` (existing) | adds `providers[]`: `{ institutionId, institutionName, orderId \| null, amountCents, usedCents, remainingCents, taxableIncomeCents }` – every depot institution plus those with an order (logo from the accounts list) |
| `POST /api/taxes/:year/orders`, `PATCH /api/taxes/orders/:id` (existing) | unchanged; used by the inline edit of the assigned amount |
| `GET /api/insurance/suggestions` (new) | `[{ key, counterparty, amountCents, interval, type, count, lastDate }]` |
| `POST /api/insurance/suggestions/:key/dismiss` (new) | 204; stores the dismissal |
| `POST /api/insurance` (existing) | used to accept a suggestion |

All amounts integer cents; errors `{ statusCode, statusMessage }` as today.
