# Implementation Plan: Trustworthy Figures, Refresh and Data Timestamp (013)

**Branch**: `20-trustworthy-figures-refresh-and-data-timestamp-013` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/013-trust-and-refresh/spec.md`

## Summary

1. **Demo removal (R5, US1)**: `DELETE /api/demo` removes everything the demo seed created (demo institutions → accounts → bookings, snapshots, positions; instruments, prices, weights and expected dividends no longer referenced; demo budgets, watchlist, insurance contract, rules) in one transaction; a confirmed button (Datenquellen page for now; moves to Einstellungen › Daten in 014). A `demo` flag on institutions marks seeded rows (migration; existing demo institutions recognized by their seeded names once).
2. **Balance check (R5)**: sync stores the source balance and its date per account (`source_balance_cents`, `source_balance_date`); `GET /api/accounts` returns both and the app balance at that date; account rows and details show a warning when they differ.
3. **Consistency tests (R5)**: API e2e on the demo dataset and on a fixture with several accounts: net worth = allocation total = Σ Portfolios & Konten; Sankey income/expenses = cash-flow summary; Σ categories = Ausgaben gesamt – for several periods and account selections.
4. **Open gaps A2/A4, A5, A18 (R5)**: re-audit with the owner's accounts (local audit file); fix where a rule is derivable, otherwise ⓘ notes stating the app's definition and the known difference.
5. **Refresh + state (R3, R4)**: `POST /api/sources/refresh-all` runs bank sync, broker sync and quote refresh one after another and returns the result per source; `GET /api/sources/state` returns per-source last success/error. Übersicht frame shows "Aktualisieren" (left of "Anpassen") and "Stand: …" with tooltip and outdated highlight.
6. **Charts (R1, R2)**: hover line and tooltip without transition (`duration` 0 on crosshair/tooltip; pointer handling unthrottled); remove `card-hover` from the dashboard.

## Technical Context

**Language/Version**: TypeScript 5 strict, Vue 3.5, Nuxt 4, NestJS 11, Drizzle/SQLite

**Primary Dependencies**: none new.

**Storage**: migration: `institution.is_demo` (boolean, default false), `account.source_balance_cents` (integer, nullable), `account.source_balance_date` (text, nullable); existing `last_sync_at` / `last_synced_at` reused for the state.

**Testing**: domain unit (demo selection, balance comparison), API e2e (demo removal, refresh-all with mocked sources, state, consistency checks), component (refresh button, state tooltip), Playwright (refresh flow, chart hover reacts immediately, no dashboard hover).

**Constraints**: removal and refresh never touch the owner's own rows; owner amounts only in the git-ignored audit file; no deployment.

## Coding Standards

Same as feature 005 (`specs/005-bank-sync-market-data/plan.md` › Coding Standards). Gates per task commit: lint, format check, typecheck, API and web unit tests.

## Constitution Check

| Principle | Check | Status |
|---|---|---|
| I. Exact Money | Consistency checks to the cent; balances in integer cents | Pass |
| II. Owner-Controlled, Local Data | Refresh uses the owner's existing connections; nothing new leaves the app | Pass |
| III. Public Repo Hygiene | No owner amounts committed | Pass |
| IV. Tested by Layer | Unit, API e2e, component, Playwright | Pass |
| V. Local First | Local dev server; no deployment | Pass |
| VI. German, Responsive, Honest UI | State and differences shown openly; ⓘ notes instead of hidden gaps | Pass |

## Project Structure

```text
specs/013-trust-and-refresh/ plan.md research.md data-model.md contracts/http-api.md quickstart.md tasks.md

apps/api/src/modules/demo/…                      # DELETE /api/demo
apps/api/src/modules/sources/{refresh-all,state}  # POST refresh-all, GET state
apps/api/src/database/{schema.ts,migrations/0013_*}
apps/api/test/e2e/{demo-removal,consistency,refresh-all}.e2e-spec.ts
apps/web/app/layouts/overview.vue                 # Aktualisieren + Stand
apps/web/app/components/{dashboard,analysis,budget,dividends,investments}/*Chart*.vue
```

## Complexity Tracking

No violations.
