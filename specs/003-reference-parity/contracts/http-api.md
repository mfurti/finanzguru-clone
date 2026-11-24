# HTTP API Contract: Reference Parity

- All routes are under `/api` and require the owner session (unchanged from 001).
- Money is in integer cents. Dates use ISO `YYYY-MM-DD`.
- DTOs are zod schemas in `packages/shared/src/dto`.

## Transactions

| Method | Path | Body / Query | Response |
|---|---|---|---|
| GET | `/transactions` | Query: `q, accountIds[], types[], categoryIds[], tagIds[], from, to, minCents, maxCents, review=all\|unreviewed\|reviewed, sort=date\|amount\|counterparty\|category\|account, dir, page, pageSize=25\|50\|100` | `{ items: TransactionRow[], total, page, pageSize, sumCents }` |
| GET | `/transactions/export.csv` | same query (no paging) + `columns[]` | CSV (`;`, UTF-8 BOM, German decimals) |
| POST | `/transactions/bulk` | `{ ids?: string[], filter?: Query, action: 'setCategory'\|'addTags'\|'removeTags'\|'markReviewed'\|'delete', value?: string \| string[] }` | `{ affected: number, undoToken?: string }` |
| POST | `/transactions/restore` | `{ undoToken }` | `{ restored: number }` (410 after 10 s) |
| DELETE | `/transactions/:id` | – | `{ undoToken }` |
| PATCH | `/transactions/:id` | existing + `tagIds?` | `TransactionRow` |
| GET | `/transactions/unreviewed/count` | existing + optional filter query | `{ count }` |

`TransactionRow` is the existing row plus these fields: `tags: { id, name, color }[]`, `categoryIcon`, `categoryColor`, `accountName`.

## Tags

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/tags` | – | `{ id, name, color, usage }[]` |
| POST | `/tags` | `{ name, color? }` | Tag (409 on duplicate) |
| PATCH | `/tags/:id` | `{ name?, color? }` | Tag |
| DELETE | `/tags/:id` | – | 204 |

## Search

| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/search` | `q` (2–100) | `{ pages: Hit[], instruments: Hit[], accounts: Hit[], transactions: Hit[] }`, max 5 each; `Hit = { id, label, sub?, to }` |

## Accounts

| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/accounts/overview` | – | `{ groups: { kind: 'depot'\|'account', totalCents, rows: { id, name, type, institution, initials, ibanMasked?, iban?, sparkline: number[], lastUpdateAt?, lastUpdateKind: 'sync'\|'import'\|null, canSync, balanceCents }[] }[] }` |
| GET | `/accounts/:id/detail` | `period=1W\|1M\|YTD\|1Y\|3Y\|5Y\|ALL` (existing periods) or `from,to` | `{ account, history: { date, valueCents }[], figures: { balanceCents, changeCents, inflowCents, outflowCents } }` |
| POST | `/accounts/:id/sync` | – | 202 when `canSync`, 409 otherwise |

## Overview

| Method | Path | Change |
|---|---|---|
| GET | `/overview/net-worth` | accepts `from,to` in addition to `period` |

## Categories

| Method | Path | Change |
|---|---|---|
| GET/POST/PATCH | `/categories` | `icon` field (key from `CATEGORY_ICONS`) |
| GET | `/categories/:id/detail` | `period` → `{ category, totalCents, history: { month, cents }[12] }`; bookings via `/transactions?categoryIds=` |

## Budgets

| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/budgets/overview` | `period=YYYY-MM` | `{ rows: { id, categoryId, name, icon, color, limitCents, spentCents, ratio, diffCents }[], total: {…same w/o ids}, series: { month, total: { budgetCents\|null, spentCents }, byBudget: Record<id, {…}> }[12] }` |

## Investments

| Method | Path | Change |
|---|---|---|
| GET | `/investments/transactions` | `sort, dir`, filter `types[], accountIds[], instrumentIds[], from, to, minCents, maxCents` |
| GET | `/analysis/returns/trailing` | `accountIds[]` → `{ period, xirr, inflation, real }[]` |
| GET | `/dividends/split` | `by=security\|region\|sector, year?` → `{ key, label, cents, share }[]` |
| GET | `/taxes/vorabpauschale` | response grouped `{ broker, rows[], subtotalCents }[]` |
