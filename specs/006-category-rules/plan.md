# Implementation Plan: Category Rules That Learn

**Branch**: `6-category-rules` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-category-rules/spec.md`

## Summary

Restore and extend rule-based categorization in the Transaktionen workspace:

1. **Category change dialog (US1)**: changing a category (chip or bulk) opens a small dialog: scope "Nur diese Buchung" / "Alle Buchungen dieses Empfängers" and "Für ähnliche Buchungen merken" with an editable rule. The API's existing `createRule` path (001) is extended with a `scope` and returns counts.
2. **Suggestions (US2)**: a new `rule_suggestion` table counts manual categorizations per normalized counterparty and category; from the second one an open suggestion is returned and listed; accept creates and applies the rule, decline hides it for good.
3. **Rules page (US3)**: create and edit form with live preview count, reorder, enable/disable on `settings/categories.vue`, using the existing rule CRUD plus `reorder` and `preview` endpoints.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 22

**Primary Dependencies**: Nuxt 4 + Nuxt UI 4 (web); NestJS 11 Fastify, Drizzle 0.45, better-sqlite3 (api); zod 4 (shared). No new dependencies.

**Storage**: SQLite; migration `0009_rule_suggestions` (one new table).

**Testing**: vitest domain + API e2e, Vue component tests, Playwright journeys (desktop and 360 px).

**Target Platform**: local dev server (web 3100, API 3101); self-hosted later.

**Project Type**: pnpm monorepo web app.

**Performance Goals**: preview count and "all bookings of this recipient" over 10 000 bookings < 500 ms.

**Constraints**: manual categories never changed by rules (FR-008); transfers stay transfers; German UI from 360 px.

**Scale/Scope**: ≤ 200 rules, ≤ 20 000 bookings.

## Coding Standards

Same as feature 005 (see `specs/005-bank-sync-market-data/plan.md` › Coding Standards): Prettier, ESLint flat config, `pnpm typecheck`, JSDoc intent comments with spec references, `data-testid` on interactive elements, German i18n keys, zod DTOs in `packages/shared`. Gates before each task commit: lint, format check, typecheck, API unit tests.

## Constitution Check

| Principle | Check | Status |
|---|---|---|
| I. Exact Money | No money logic changes; amount sign filter uses cents | Pass |
| II. Owner-Controlled, Local Data | Rules are explicit and visible; no external service, no hidden model | Pass |
| III. Public Repo Hygiene | No new fixtures with personal data; test counterparties are invented | Pass |
| IV. Tested by Layer | Domain tests (normalization, suggestion threshold, manual protection), API e2e, component tests (dialog, rules form), Playwright per story | Pass |
| V. Local First | Verified on the local dev server; no deployment | Pass |
| VI. German, Responsive, Honest UI | German dialog and rules page, 360 px, counts shown before changes | Pass |

Post-design re-check: unchanged.

## Project Structure

### Documentation

```text
specs/006-category-rules/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/http-api.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
packages/shared/src/schemas/
├── transaction.ts            # updateTransactionInput.scope; bulk setCategory createRule
└── category.ts               # rule preview, reorder, suggestion DTOs

apps/api/src/
├── database/schema.ts        # rule_suggestion
├── database/migrations/0009_rule_suggestions.sql
├── domain/categorize.ts      # counterpartyKey(), ruleFromCounterparty()
├── domain/rule-suggestions.ts  # threshold logic (new)
├── modules/transactions/transactions-review.service.ts  # scope 'recipient', counts, suggestion
├── modules/transactions/transactions-bulk.service.ts    # setCategory + createRule
└── modules/categories/
    ├── categories.service.ts # preview, reorder, enable, suggestions accept/decline
    └── categories.controller.ts

apps/web/app/
├── components/transactions/CategoryChangeDialog.vue  # new
├── components/transactions/RuleFields.vue            # new, shared by dialog and rules page
├── components/transactions/RuleSuggestions.vue       # new, banner on Transaktionen
├── components/transactions/BookingsTable.vue         # chip opens dialog
├── components/transactions/BulkBar.vue               # bulk dialog
└── pages/settings/categories.vue                     # create/edit/reorder/toggle/preview

apps/api/test/{unit,e2e}/…, apps/web/tests/…, e2e/us-r1-…, us-r2-…, us-r3-….spec.ts
```

**Structure Decision**: existing modules; no new Nest module.

## Complexity Tracking

No violations.
