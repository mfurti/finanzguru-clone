# Data Model: Owner Review Round (012)

## New table `insurance_suggestion_dismissal`

| Column | Type | Rule |
|---|---|---|
| key | text PK | normalized counterparty + interval, 1–200 chars |
| dismissed_at | text (ISO timestamp) | not null |

## Derived (no storage)

- **Insurance suggestion**: key, counterparty, amountCents (last payment, positive), interval (`monthly` \| `quarterly` \| `half_yearly` \| `yearly`), type (insurance type from the sub category, fallback `other`), bookings (count, last date).
- **Exemption provider row**: institutionId, name, logo, year, assignedCents, usedCents, availableCents = max(0, assigned − used).
- **Dividend summary additions**: portfolioValueCents, yearCents, byCurrency (key = ISO currency or `unknown`, label, cents, pct).

## Client storage (local storage)

- `vk.bookings.columns` (existing, migrated): visible flags for date, category, tags, properties, amount, taxes.
- `vk.positions.columns`: `{ order: string[], visible: Record<string, boolean> }`.
