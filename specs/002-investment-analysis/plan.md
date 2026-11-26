# Implementation Plan: Investment Analysis, Dividends, Taxes and Watchlists

**Branch**: `2-investment-analysis` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-investment-analysis/spec.md`

## Summary

Close the gaps found when comparing the reference tool with the dev site: an Analyse page (breakdowns by asset class, region, sector, currency, volatility, return and custom groups; return line/heatmap/bars; yearly IZF vs. inflation vs. real return; depot comparison), Dividenden (summary, history, calendar with expected payments), Steuern (exemption orders with usage, Vorabpauschale estimate), "Vergleichen mit" benchmark lines, watchlists, a full bookings table with filters and export, and a budget pie chart. Everything builds on the 001 code: same modules pattern, same domain math (TWROR/XIRR, FIFO positions, snapshots), one new migration, owner-maintained reference data instead of market-data feeds, plus a "Kursliste" CSV format for prices of benchmarks and watchlist securities.

## Technical Context

**Language/Version**: TypeScript ~5.9.3 on Node.js 26

**Primary Dependencies**: Nuxt 4 + Nuxt UI 4 + @nuxtjs/i18n + @unovis/vue (web); NestJS 11 on Fastify, nestjs-zod, Drizzle ORM 0.45 + better-sqlite3, decimal.js (api); zod 4 in `packages/shared`. No new dependencies.

**Storage**: SQLite file (WAL), migration `0005_investment_analysis` (see [data-model.md](./data-model.md))

**Testing**: Vitest (domain unit, Nest e2e via `inject()`, Nuxt components), Playwright journeys + responsive check

**Target Platform**: Self-hosted Linux containers (unchanged), local dev on Windows with `pnpm dev:local` (web 3100, API 3101)

**Project Type**: Web application (pnpm monorepo: `apps/web`, `apps/api`, `packages/shared`)

**Performance Goals**: Each new page < 2 s with 5 years of daily history and 10,000 bookings (SC-005), measured with the 001 perf script

**Constraints**: Money in integer cents, decimals as strings; no external data calls (FR-023); 360 px without horizontal scroll, dark and light; German UI; no private infrastructure details in the public repo

**Scale/Scope**: Single owner; ~6 new pages/sections, ~30 endpoints, 11 new tables/columns

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template, so there are no ratified gates. The plan applies the working rules established in 001 instead:

| Rule (from 001 practice) | Status |
|---|---|
| Money as integer cents, decimals as strings, half-even rounding | Pass: all new figures reuse `domain/money.ts` |
| Data stays local, read-only external sources | Pass: no new external calls; prices via CSV/manual |
| Test per layer (domain unit, API e2e, Playwright per story) | Pass: R15 |
| Quality gates before each task commit (lint, format, typecheck) | Pass: unchanged `done.sh` flow |
| No private infrastructure details in the repo | Pass: docs use placeholders only |

Post-design re-check: no violations, Complexity Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-investment-analysis/
├── spec.md
├── plan.md              # This file
├── research.md          # R1–R15
├── data-model.md
├── quickstart.md        # W1–W16
├── contracts/
│   └── http-api.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks output
```

### Source Code (repository root)

```text
packages/shared/src/
├── classification.ts          # region/sector/currency key lists, labels, fund types
└── dto/                       # analysis, dividends, taxes, watchlists, benchmarks DTOs

apps/api/src/
├── database/
│   ├── schema.ts              # + instrument_weight, custom_grouping/group/member, inflation_rate,
│   │                          #   expected_dividend, tax_year, exemption_order, watchlist(_entry),
│   │                          #   user_setting; instrument.fund_type, instrument.is_benchmark
│   ├── migrations/0005_investment_analysis.sql
│   └── demo.ts                # demo classifications, dividends, taxes, benchmark, watchlist
├── domain/
│   ├── breakdown.ts           # weighted buckets, largest-remainder rounding
│   ├── volatility.ts
│   ├── period-returns.ts      # monthly/yearly TWROR, yearly XIRR
│   ├── dividends.ts           # last 12 months, yield, CAGR, expected amounts
│   ├── exemption.ts           # taxable income, usage
│   └── vorabpauschale.ts
└── modules/
    ├── analysis/              # breakdown, returns, compare, groupings, inflation settings
    ├── instruments/           # create, classification, manual prices
    ├── dividends/
    ├── taxes/
    ├── benchmarks/            # benchmark list/series, chart settings
    ├── watchlists/
    ├── investments/           # extended transactions query + CSV export
    └── sources/csv/price-list.ts   # "Kursliste" format

apps/web/app/
├── pages/investments/
│   ├── analysis.vue
│   ├── dividends.vue
│   ├── taxes.vue
│   ├── watchlists/index.vue, [id].vue
│   └── transactions.vue       # rebuilt as table
├── components/
│   ├── analysis/              # BreakdownCard, ReturnHeatmap, ReturnViews, YearlyTable,
│   │                          # CompareChart, ClassificationForm, GroupingEditor
│   ├── dividends/             # DividendSummary, DividendHistory, DividendCalendar, ExpectedForm
│   ├── taxes/                 # ExemptionOrders, VorabpauschaleTable
│   ├── watchlists/            # WatchlistTable, AddSecurityForm
│   ├── common/BenchmarkSelect.vue
│   ├── investments/InvestmentsNav.vue, TransactionsTable.vue
│   └── budget/CategoryDonut.vue
└── i18n/locales/de.json

e2e/
└── us7-analysis.spec.ts … us13-budget-pie.spec.ts (one per story), responsive.spec.ts (+ new pages)
```

**Structure Decision**: Same monorepo layout as 001. New API features get their own Nest modules next to the 001 modules; pure calculations go to `apps/api/src/domain` with unit tests; shared DTOs and key lists go to `packages/shared`.

## Phases

- **Phase 0 – Research**: done, see [research.md](./research.md) (R1–R15, no open questions).
- **Phase 1 – Design**: done, see [data-model.md](./data-model.md), [contracts/http-api.md](./contracts/http-api.md), [quickstart.md](./quickstart.md).
- **Phase 2 – Tasks**: `/speckit-tasks` generates `tasks.md`, ordered: setup → foundational (migration, shared DTOs, instruments module, price list CSV, navigation) → US1 … US7 by priority → polish (perf, responsive, docs, local test).

## Relationship to feature 001

- Builds on the 001 code base; branch `2-investment-analysis` starts from the 001 branch tip.
- 001's open work stays tracked in its own tasks: US3 Scalable sync (T054–T058) and deployment (T079–T083). 002 does not block them; if 001 is deployed first, 002 deploys through the same release pipeline.

## Complexity Tracking

No violations.
