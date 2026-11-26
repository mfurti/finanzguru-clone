# Implementation Plan: Figures, Calculations and Layout Checked Against the Reference

**Branch**: `12-figures-calculations-and-layout-checked-against-the-reference-audit-010` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-reference-audit/spec.md`

## Summary

1. **Reference rules first (research)**: derive the reference's definitions for invested capital, cost basis, period price gain, realized gains (lot matching, taxes), Gesamtertrag, Gespart/Sparquote, unreviewed count and monthly bars from its UI (read only) and the owner's trades; document them in `research.md` (definitions, no amounts).
2. **Calculations (US1)**: fix the domain functions in `apps/api/src/domain/` (`positions.ts`, `returns.ts`, `period-returns.ts`, `cashflow.ts`, `snapshots.ts`, `instrument-values.ts`) and their services (`overview/portfolio.service.ts`, `overview/overview.service.ts`, `investments/*`), each with fixture-based unit tests that encode the reference rule.
3. **Categories (US2)**: extend the built-in default rules for common merchants (generic merchant words only), applied to uncategorized bookings without touching owner rules or manual categories.
4. **Tables (US3)**: booking list for phones (date-grouped rows) inside `BookingsTable`, tablet column set with short date, positions/investment bookings/taxes tables fitted with a sticky first column.
5. **Look (US4)**: one control size via `app.config.ts` defaults for `USelect`, `USelectMenu`, `UInput`, `UButton` in toolbars; framed figure boxes (`SummaryTiles.vue`) with label-left rows for Gespart/Sparquote and a five-in-a-row variant on Analyse.
6. **Guards**: owner audit script (prints app figures for the chosen accounts locally) and a Playwright layout guard over all pages at 375/768/1440 px.

## Technical Context

**Language/Version**: TypeScript 5 strict, Node 22

**Primary Dependencies**: none new.

**Storage**: no schema change expected; default category rules seeded via the existing seed/default-rule mechanism (data migration only if the seed cannot reach existing databases – decided in T002).

**Testing**: vitest domain unit tests with invented trade/booking fixtures per reference rule; API e2e for changed figures; component tests for booking list and figure boxes; Playwright layout guard and per-story journeys.

**Target Platform**: local dev server (web 3100, API 3101).

**Project Type**: pnpm monorepo web app.

**Performance Goals**: unchanged list/overview response times (figures computed per request as today).

**Constraints**: reference only viewed; owner amounts never committed (local audit file git-ignored); money in integer cents, half-even rounding (Constitution I).

**Scale/Scope**: ≈ 12 figures, 15 pages × 3 widths, ≈ 40 default merchant rules.

## Coding Standards

Same as feature 005 (`specs/005-bank-sync-market-data/plan.md` › Coding Standards). Gates per task commit: lint, format check, typecheck, API and web unit tests.

## Constitution Check

| Principle | Check | Status |
|---|---|---|
| I. Exact Money | All corrected figures in integer cents, half-even rounding, fixtures with exact expectations | Pass |
| II. Owner-Controlled, Local Data | Reference only viewed; owner values in a git-ignored local file | Pass |
| III. Public Repo Hygiene | Spec lists gaps without amounts; default rules use generic merchant words only | Pass |
| IV. Tested by Layer | Domain unit per rule, API e2e, component, Playwright guard | Pass |
| V. Local First | Local dev server; no deployment | Pass |
| VI. German, Responsive, Honest UI | Phone list, tablet columns, figure boxes; ⓘ texts updated to the documented formulas | Pass |

Post-design re-check: unchanged.

## Project Structure

```text
specs/010-reference-audit/ plan.md research.md data-model.md quickstart.md contracts/http-api.md tasks.md

apps/api/src/scripts/audit-figures.ts              # local owner audit (prints figures, writes nothing to the repo)
apps/api/src/domain/{positions.ts,returns.ts,period-returns.ts,cashflow.ts,snapshots.ts,instrument-values.ts,categorize.ts}
apps/api/src/modules/{overview,investments,cashflow,transactions}/…
apps/web/app/app.config.ts                         # control size defaults
apps/web/app/components/transactions/{BookingsTable.vue,BookingList.vue}
apps/web/app/components/investments/PositionsTable.vue
apps/web/app/components/budget/SummaryTiles.vue
e2e/layout-guard.spec.ts
```

## Complexity Tracking

No violations.
