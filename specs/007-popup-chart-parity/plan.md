# Implementation Plan: Popups, Tables and Charts Like the Reference

**Branch**: `7-popup-chart-parity` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-popup-chart-parity/spec.md`

## Summary

Mostly web work, one small API change:

1. **Transaktionen (US1)**: default columns like the reference (Konto and purpose optional, off), name truncation so Betrag always fits; a booking side panel (`BookingPanel.vue`, slide-over) opened by row click; a large category window (`CategoryWindow.vue`) that replaces the chip dropdown and absorbs the 006 dialog (scope, merken, rule fields). API: `transaction.note` (≤ 1 000 chars) via the existing PATCH.
2. **Filter (US2)**: `BookingFilterPanel` becomes a slide-over with Konten, Art, Zeitraum, Kategorie, Tags, Kontobewegungen, Min/Max, Status; API list filter gains `direction` (`in` | `out`).
3. **Dashboard (US3)**: header row, ⓘ via `InfoTooltip`, compact axis, line without fill in `NetWorthChart`; card title links and ⋮ menus; two fixed columns with the reference order; Holdings Top/Flop side by side; one-line review tile; Kennzahlen grid.
4. **Cash-flow charts (US4)**: shared month-axis labels, boxed figures, Sankey card on Analyse, donut without gaps.
5. **Add window (US5)**: `AddWindow.vue` replaces `AddMenu` with provider list (static, supported providers only) and the import-method step.

## Technical Context

**Language/Version**: TypeScript 5 strict, Node 22

**Primary Dependencies**: Nuxt 4, Nuxt UI 4 (`USlideover`, `UModal`), Unovis (web); NestJS 11, Drizzle (api); zod 4 (shared). No new dependencies.

**Storage**: SQLite; migration `0010_transaction_note` (one nullable column).

**Testing**: vitest (API e2e, Vue component tests), Playwright desktop + 360 px, dark/light.

**Target Platform**: local dev server (web 3100, API 3101).

**Project Type**: pnpm monorepo web app.

**Performance Goals**: side panel opens < 200 ms (data from the list row, notes fetched with the row).

**Constraints**: Betrag visible from 1024 px without horizontal scroll (FR-001); German UI from 360 px.

**Scale/Scope**: 8 places from the comparison; ≈ 15 components touched.

## Coding Standards

Same as feature 005 (`specs/005-bank-sync-market-data/plan.md` › Coding Standards). Gates per task commit: lint, format check, typecheck, API unit tests.

## Constitution Check

| Principle | Check | Status |
|---|---|---|
| I. Exact Money | Amounts unchanged; compact axis only formats labels; figures still exact | Pass |
| II. Owner-Controlled, Local Data | No external service; notes stay local | Pass |
| III. Public Repo Hygiene | No real data in tests or screenshots committed | Pass |
| IV. Tested by Layer | API e2e (note, direction filter), component tests (panel, window, filter, add window, dashboard cards), Playwright per story | Pass |
| V. Local First | Local dev server; no deployment | Pass |
| VI. German, Responsive, Honest UI | All new UI German, 360 px, dark/light; ⓘ explains figures | Pass |

Post-design re-check: unchanged.

## Project Structure

```text
specs/007-popup-chart-parity/ plan.md research.md data-model.md quickstart.md contracts/http-api.md tasks.md

packages/shared/src/schemas/transaction.ts   # note, direction filter
apps/api/src/database/{schema.ts,migrations/0010_transaction_note.sql}
apps/api/src/modules/transactions/{transactions-review.service.ts,transactions.controller.ts}

apps/web/app/components/transactions/
├── BookingsTable.vue        # columns, truncation, row click
├── BookingPanel.vue         # new side panel
├── CategoryWindow.vue       # new large category window (replaces chip dropdown + CategoryChangeDialog)
├── BookingFilterPanel.vue   # slide-over
apps/web/app/components/dashboard/
├── NetWorthChart.vue        # header row, ⓘ, compact axis, no fill
├── CardTitle.vue            # new: title link + ⋮ menu
├── AllocationCard.vue HoldingsCard.vue KpiCard.vue ReviewBanner.vue CashflowCard.vue BudgetsCard.vue AccountsCard.vue
apps/web/app/pages/index.vue # two columns, reference order
apps/web/app/components/common/{MonthAxis.ts,DonutChart.vue,AddWindow.vue}
apps/web/app/pages/budget/index.vue  # boxed figures, Sankey card
```

## Complexity Tracking

No violations.
