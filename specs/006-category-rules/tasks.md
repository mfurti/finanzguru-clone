# Tasks: Category Rules That Learn

**Input**: Design documents from `specs/006-category-rules/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: Included (Constitution IV): domain unit, API e2e, component tests, one Playwright journey per story.

**Standards**: plan.md › Coding Standards. Gates before each commit: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, API unit tests.

**Origin**: Restores 001 T069 "Regel speichern", lost when 003 T026 turned the review page into a redirect (audit of 001–005 on 2026-11-25; no other lost function found).

**Commits**: One commit per task, pushed immediately; issue checklist synced. No deployment tasks.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 [P] Shared DTOs per `contracts/http-api.md`:
  - `packages/shared/src/schemas/transaction.ts`: `updateTransactionInput.scope` (`'single' | 'recipient'`, default `single`), `createRule.amountSign` optional; response `categorizeResult { updated, ruleId, ruleApplied, suggestion }`; bulk `setCategory` accepts `createRule`.
  - `packages/shared/src/schemas/import.ts` (where the rule DTOs of 001 live): `ruleDraft` (used as preview input and `createRule`), `rulePreviewResult { matches, wouldChange }`, `ruleReorderInput { ids: string[] (min 1) }`, `ruleSuggestionDto { id, counterparty, categoryId, count, affected }`.
- [X] T002 [P] German texts in `apps/web/i18n/locales/de.json`: "Nur diese Buchung", "Alle Buchungen dieses Empfängers", "Für ähnliche Buchungen merken", "Regel", "Feld" (Gegenpartei, IBAN, Verwendungszweck), "Bedingung" (enthält, ist gleich, beginnt mit, regulärer Ausdruck), "Nur Einnahmen", "Nur Ausgaben", "{n} Buchungen würden geändert", "{n} Buchungen geändert", "Regel gespeichert", "Regel anlegen?", "Annehmen", "Nicht mehr vorschlagen", "Neue Regel", "Regel bearbeiten", "Nach oben", "Nach unten", "Aktiv", "Ungültiger regulärer Ausdruck", "Für unterschiedliche Empfänger kann keine Regel gespeichert werden". Remove the stale review keys `budget.review.*` and `overview.review.*` that no page uses.

---

## Phase 2: Foundational

- [X] T003 Migration `apps/api/src/database/migrations/0009_rule_suggestions.sql` and `apps/api/src/database/schema.ts`: table `rule_suggestion` (`id` text PK; `counterparty_key` text not null, "1–200 chars"; `category_id` → `category.id` on delete cascade; `count` integer not null default 0, "≥ 0"; `status` text not null default `open`, "`open`, `accepted`, `declined`"; `updated_at` default now; unique `(counterparty_key, category_id)`). Test in `apps/api/test/unit/schema-006.spec.ts` (checks, unique, cascade). The migration is additive (new table only), so no upgrade test with child rows is needed.
- [X] T004 [P] Domain helpers in `apps/api/src/domain/categorize.ts`: `counterpartyKey(tx)` (normalized counterparty or null), `draftRuleFor(tx)` (research R2: `counterparty contains <key>`, else IBAN `equals`, else purpose `contains` first 40 chars after the posting text), `wouldChange(tx)` (category source null or `rule` — `import` and `manual` stay; type income, expense or fee, never `transfer` or trades). Unit tests in `apps/api/test/unit/dedupe-categorize.spec.ts`.

---

## Phase 3: User Story 1 – Remember a category while categorizing (P1) 🎯 MVP

**Goal**: Category change asks for scope and offers "merken"; rules apply to future and existing bookings.

**Independent Test**: Rent booking → "Miete", recipient scope, merken: all uncategorized rent bookings change; next import matches.

- [X] T005 [US1] API: extend `update()` in `apps/api/src/modules/transactions/transactions-review.service.ts`: `scope: 'recipient'` also sets the category (source `manual`, reviewed) on all bookings with the same `counterpartyKey` that pass `wouldChange` (400 without counterparty); `createRule` appends the rule (with `amountSign`) and applies it to bookings passing `wouldChange` with source → `rule`; returns `{ updated, ruleId, ruleApplied, suggestion: null }`. Rule saving and applying lives in `apps/api/src/modules/transactions/rule-apply.ts` (`appendRule`, `applyRule`), reused by bulk and suggestions; a new rule applies to every booking passing `wouldChange` (not only unreviewed ones). Manual bookings stay untouched (FR-008). API e2e in `apps/api/test/e2e/category-rules.e2e-spec.ts` (single, recipient, merken, manual protected, transfer protected, 400 cases).
- [X] T006 [US1] API: bulk `setCategory` with `createRule` in `apps/api/src/modules/transactions/transactions-bulk.service.ts` — allowed only when all selected bookings share one `counterpartyKey` (else 400 "Für unterschiedliche Empfänger …"); creates the rule once and applies it. E2e in `category-rules.e2e-spec.ts`.
- [X] T007 [P] [US1] Web `apps/web/app/components/transactions/RuleFields.vue`: field, operator, pattern, amount-sign select, live preview count via `POST /api/rules/preview` (debounced 300 ms; used again in US3). The preview endpoint (planned in T014) is built here, since the dialog needs it first: `CategoriesService.preview` + route before `rules/:id`, e2e in `category-rules.e2e-spec.ts`. Component test `apps/web/tests/rule-fields.spec.ts`.
- [X] T008 [US1] Web `apps/web/app/components/transactions/CategoryChangeDialog.vue`: opens after picking a category on the chip in `BookingsTable.vue` and from "Kategorie setzen" in `BulkBar.vue`; scope radio (recipient option hidden without counterparty, and for bulk with mixed recipients), checkbox "Für ähnliche Buchungen merken" revealing `RuleFields` pre-filled from `draftRuleFor`; Enter saves with "Nur diese Buchung" (≤ 2 extra clicks for merken, SC-001); toast with counts. The chip and the bulk select open the dialog instead of saving at once; a produced suggestion bumps the shared state `rule-suggestions-refresh` for US2. Component test `apps/web/tests/category-change-dialog.spec.ts` (with `apiFetch` mocked).
- [X] T009 [US1] Playwright `e2e/us-r1-category-rules.spec.ts`: recipient scope + merken on three bookings of an invented recipient (created and removed through the API), rule visible on the rules page; desktop and 360 px. The older journeys `us-p1-transactions.spec.ts` (W2, W2b) and `us5-budget.spec.ts` (V10) now confirm the dialog. Manual protection is pinned by the API e2e test (T005).

---

## Phase 4: User Story 2 – Suggestions from repeated corrections (P2)

**Goal**: Second identical manual categorization suggests a rule; decline is final.

**Independent Test**: Two Telekom bookings → Handy (single) → suggestion; accept creates rule; decline never returns.

- [ ] T010 [P] [US2] Domain `apps/api/src/domain/rule-suggestions.ts` (research R4): `shouldSuggest(count, status, coveredByRule)` (count ≥ 2, status `open`, not covered). Unit test `apps/api/test/unit/rule-suggestions.spec.ts`.
- [ ] T011 [US2] API: in `transactions-review.service.ts` upsert `rule_suggestion` on every single-scope manual categorization with counterparty and return `suggestion` when `shouldSuggest`; "merken" marks a matching suggestion `accepted`. Endpoints in `apps/api/src/modules/categories/categories.controller.ts` + service: `GET /api/rules/suggestions`, `POST /api/rules/suggestions/:id/accept` (creates pre-filled rule and applies it), `POST /api/rules/suggestions/:id/decline` (204), declared before `rules/:id`. E2e `apps/api/test/e2e/rule-suggestions.e2e-spec.ts`.
- [ ] T012 [US2] Web `apps/web/app/components/transactions/RuleSuggestions.vue`: banner on Transaktionen with open suggestions (counterparty, category chip, affected count, "Annehmen", "Nicht mehr vorschlagen"); the category-change toast offers "Regel anlegen" when the response carries a suggestion. Component test `apps/web/tests/rule-suggestions.spec.ts`.
- [ ] T013 [US2] Playwright `e2e/us-r2-rule-suggestions.spec.ts`: two single categorizations → suggestion → accept; second pair → decline → reload, not shown.

---

## Phase 5: User Story 3 – Manage rules (P2)

**Goal**: Create, edit, reorder, enable/disable rules with preview.

**Independent Test**: New purpose rule with preview count, move up, switch off.

- [X] T014 [P] [US3] API in `apps/api/src/modules/categories/`: (preview already done in T007) `POST /api/rules/reorder` (full id list, two-pass priority rewrite in one transaction; 400 when the list does not contain exactly all rule ids), POST `/api/rules` appends at the end. E2e `apps/api/test/e2e/rules-management.e2e-spec.ts`.
- [ ] T015 [US3] Web `apps/web/app/pages/settings/categories.vue`: "Neue Regel" and edit dialogs with `RuleFields` and category select, up/down buttons, "Aktiv" switch (PATCH `enabled`), rule rows show field, condition, pattern and category chip; replace the stale "Lege sie beim Prüfen an" empty text. Component test `apps/web/tests/rules-page.spec.ts`.
- [ ] T016 [US3] Playwright `e2e/us-r3-rules-management.spec.ts`: create with preview, reorder, disable, delete; 360 px.

---

## Phase 6: Polish

- [ ] T017 Owner walkthrough W1–W5 on the local dev server with the real Sparkasse bookings (rent, electricity, Klarna); record results without personal data in `quickstart.md`.
- [ ] T018 Full gates (`pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`), W6 at 360 px dark/light; mark spec Status "Implemented".

---

## Dependencies & Execution Order

- Setup T001–T002 [P] → Foundational T003, T004 → stories.
- US1: T005 → T006; T007 parallel; T008 after T005–T007; T009 last.
- US2 needs T005 (suggestion upsert lives in the same service call): T010 [P] → T011 → T012 → T013.
- US3 independent of US2: T014 [P] → T015 → T016; T015 reuses `RuleFields` (T007).
- Polish after all stories.

## Parallel Examples

- T001 + T002 + T004.
- T007 (RuleFields) while T005/T006 are built.
- T010 and T014 together.

## Implementation Strategy

1. MVP: Setup + Foundational + US1 → W1–W3.
2. US3 (rules page), then US2 (suggestions).
3. Polish T017–T018.
