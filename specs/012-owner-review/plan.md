# Implementation Plan: Owner Review Round (012)

**Branch**: `18-owner-review-round-columns-navigation-investments-budget-insurance-012` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-owner-review/spec.md`

## Summary

1. **Navigation (P3, P5, P10 label)**: Übersicht gets a parent route like Investments/Budget (`pages/overview.vue` frame with `SectionNav` + `<NuxtPage>`; Dashboard, Portfolios & Konten, Transaktionen become its children while keeping their URLs `/`, `/accounts`, `/transactions` via route aliases), so the side navigation stays mounted. Labels "Buchungen" and "Watchlist".
2. **Columns (P1, P2)**: Transaktionen: columns Datum, Kategorie, Tags, Eigenschaften (icons: transfer, excluded, note, split), Betrag, Steuern; Konto/Verwendungszweck move out of the chooser (still in the side panel); stored choice migrated. Positionen: new `ColumnsPanel` slideover (select all, checkbox list, drag to reorder, Speichern) with columns incl. Realisiert € and Transaktionen; choice and order in local storage.
3. **Investments (P4, P15)**: Art badge component (Kauf green, Verkauf blue, others neutral) above the date; account filter in Investments lists only depot accounts.
4. **Dividends (P6–P8)**: research the yearly difference with the owner's accounts (local audit, no amounts committed) and fix the cause; new summary fields `portfolioValueCents`, `yearCents` and `byCurrency`; page header becomes three cards (Investments, Dividendenerträge, Dividendenrendite); Aufteilung tab Währungen.
5. **Taxes (P9)**: provider rows per institution with a depot or an exemption order: assigned (inline edit, existing exemption order API), used (exempted income booked to that institution in the year), bar, available.
6. **Sankey (P11)**: order mains with sub categories first (by amount), then mains without sub categories (incl. "Nicht kategorisiert"), then the balance; add an invisible filler sub node where sub categories do not add up to their main; result: no upward flows.
7. **Donut (P12)**: `DonutChart` gets a `responsive` mode (size from its container, ring and text scale with it); the budget categories card uses it (max 400 px).
8. **Watchlist (P10)**: tabs per watchlist, default watchlist created on first visit, header with count, period switch, Hinzufügen, ⋮ (rename, delete), reference empty state.
9. **Budgets (P13)**: one card with period header and actions, faded month chart, own illustration, CTA; table columns Budgethöhe, Ausgaben, Status, Differenz when budgets exist.
10. **Insurance (P14)**: detect recurring outgoing bookings in the Versicherung categories (same counterparty, similar amount, monthly/quarterly/yearly) as suggestions; accept → contract prefilled; dismiss → stored.

## Technical Context

**Language/Version**: TypeScript 5 strict, Vue 3.5, Nuxt 4, NestJS 11, Drizzle/SQLite

**Primary Dependencies**: none new (drag to reorder with native HTML5 drag and drop + keyboard buttons).

**Storage**: one new table `insurance_suggestion_dismissal` (key, dismissed_at) via a reviewed Drizzle migration; no other schema change (exemption orders, watchlists exist).

**Testing**: domain unit tests (sankey order/filler, insurance detection, dividend currency split, used exemption per provider); API e2e (dividend summary fields, insurance suggestions, provider rows); component tests (columns panel, art badge, donut responsive); Playwright (Übersicht nav stays mounted, columns, layout guard, hydration, Sankey hover).

**Target Platform**: local dev server (web 3100, API 3101).

**Constraints**: owner amounts only in the git-ignored audit file; reference illustration not copied; no deployment.

**Scale/Scope**: 15 points, ≈ 20 tasks.

## Coding Standards

Same as feature 005 (`specs/005-bank-sync-market-data/plan.md` › Coding Standards). Gates per task commit: lint, format check, typecheck, API and web unit tests.

## Constitution Check

| Principle | Check | Status |
|---|---|---|
| I. Exact Money | Dividends, exemption amounts and insurance suggestions in integer cents | Pass |
| II. Owner-Controlled, Local Data | Reference only looked at; suggestions computed locally | Pass |
| III. Public Repo Hygiene | No owner amounts in spec/tests; own illustration | Pass |
| IV. Tested by Layer | Unit, API e2e, component, Playwright per story | Pass |
| V. Local First | Local dev server; no deployment | Pass |
| VI. German, Responsive, Honest UI | German labels, 375/768/1440, dark/light | Pass |

Post-design re-check: unchanged.

## Project Structure

```text
specs/012-owner-review/ plan.md research.md data-model.md contracts/http-api.md quickstart.md tasks.md

apps/web/app/pages/overview.vue (+ children)             # P3 frame
apps/web/app/components/common/{SectionNav.vue,AccountFilter.vue,ColumnsPanel.vue,DonutChart.vue}
apps/web/app/components/transactions/BookingsTable.vue    # P1
apps/web/app/components/investments/{PositionsTable.vue,TransactionsTable.vue,ArtBadge.vue}
apps/web/app/pages/investments/{dividends.vue,taxes.vue,watchlists/…}
apps/web/app/components/{dividends,taxes,watchlists,budget,insurance}/…
apps/web/app/utils/sankey-option.ts                       # P11
apps/api/src/domain/{dividends.ts,insurance-suggestions.ts,exemption.ts}
apps/api/src/modules/{investments,taxes,insurance}/…
apps/api/drizzle/…                                         # dismissal table
```

## Complexity Tracking

No violations.
