# HTTP API: Figures, Calculations and Layout Checked Against the Reference (010)

No new routes; shapes stay the same, meanings are corrected.

| Endpoint | Field | Change |
|---|---|---|
| `GET /api/overview/net-worth` | `totalCents`, `gainCents` | Same valuation as allocation (FR-001); gain per R1 |
| `GET /api/overview/kpis` | `investedCents`, `priceGain`, `realized`, `taxesFeesCents`, `totalReturnCents`, `twror`, `irr`, `realReturn` | Reference definitions (R1, R2); `realReturn` null when the reference shows none |
| `GET /api/investments/positions` | `entryValueCents`, `avgPrice`, `gainCents`, `gainPct` | Cost basis of the open position (R1) |
| `GET /api/investments/performance`, net-worth series | series values | No artificial drops (R3) |
| `GET /api/cashflow/summary` | `expenseCents`, `balanceCents`, `savedCents`, `savingsRate` | "Sparen und Anlegen" counts as expense and Gespart (R4) |
| `GET /api/transactions/unreviewed/count` | `count` | Rule per R6 |
