# HTTP API: Category Rules That Learn (006)

All routes need the owner session. DTOs in `packages/shared/src/schemas/`.

## Category change

| Method | Path | Body | Result |
|---|---|---|---|
| PATCH | `/api/transactions/:id` (existing, extended) | `{ categoryId, scope?: 'single' \| 'recipient', createRule?: { matchField, operator, pattern, amountSign? } }` | `{ updated, ruleId: string \| null, ruleApplied: number, suggestion: SuggestionDto \| null }` |
| POST | `/api/transactions/bulk` (existing, extended) | `{ ids, action: 'setCategory', value, createRule? }` | `{ affected, ruleId?, ruleApplied? }`; `createRule` with mixed counterparties → 400 |

`scope = 'recipient'` without counterparty → 400. `updated` counts the booking itself plus the recipient's other changed bookings.

## Rules

| Method | Path | Result |
|---|---|---|
| GET/POST | `/api/rules` (existing) | list / create (POST appends at the end) |
| PATCH | `/api/rules/:id` (existing) | edit fields incl. `enabled` |
| DELETE | `/api/rules/:id` (existing) | 204 |
| POST | `/api/rules/apply` (existing) | `{ updated }` |
| POST | `/api/rules/preview` | body: draft rule → `{ matches, wouldChange }` |
| POST | `/api/rules/reorder` | body `{ ids: string[] }` (all rule ids in the new order) → rules list |

## Suggestions

| Method | Path | Result |
|---|---|---|
| GET | `/api/rules/suggestions` | open suggestions with `count ≥ 2`: `{ id, counterparty, categoryId, count, affected }[]` |
| POST | `/api/rules/suggestions/:id/accept` | `{ ruleId, applied }` |
| POST | `/api/rules/suggestions/:id/decline` | 204 |

`rules/preview`, `rules/reorder`, `rules/suggestions…` are declared before `rules/:id`.
