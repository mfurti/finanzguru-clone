# Implementation Plan: Reference Parity (Vermögenskompass ↔ Finanzfluss Copilot)

**Branch**: `3-reference-parity` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-reference-parity/spec.md`

## Summary

Close the remaining differences found in the 2026-11-24 page-by-page comparison:

- **Navigation**: the Budget area becomes Analyse | Sankey | Budgets, and reviewing moves into Übersicht › Transaktionen. Main tabs get an underline, and the header gets a global search.
- **Übersicht**:
  - A full transactions workspace: multi-select, bulk actions, tags, filter panel, sorting, page sizes, export, and delete with undo.
  - Portfolios & Konten as one card per group with sparklines and an account detail page.
  - Dashboard: custom date range on the net-worth chart, plus an unreviewed card.
- **Investments refinements**: sorting, copy, avatars, asset legend, a bookings filter panel, Zeiträume, dividend split by region and sector, Vorabpauschale per broker.
- **Budget**: period picker, Sankey page, category icons and details, Budgets page with a chart and a table, one color per category.
- **Font**: Outfit.

Everything extends the 001/002 code:

- Same Nest module pattern, shared zod DTOs and Nuxt components.
- One migration (`0006_reference_parity`).
- One new runtime dependency: the Outfit font package (served by the app itself).

## Technical Context

**Language/Version**: TypeScript ~5.9.3 on Node.js 26

**Primary Dependencies**:

- Web: Nuxt 4, Nuxt UI 4, @nuxtjs/i18n, @unovis/vue, d3-shape, d3-sankey.
- API: NestJS 11 on Fastify, nestjs-zod, Drizzle ORM 0.45 with better-sqlite3, decimal.js.
- Shared: zod 4 in `packages/shared`.
- New: `@fontsource-variable/outfit` (OFL font files bundled by Vite), see research R11.

**Storage**: SQLite (WAL); migration `0006_reference_parity` (see [data-model.md](./data-model.md)); undo copies of deleted bookings in memory for 10 s

**Testing**: Vitest (domain unit, Nest e2e via `inject()`, Nuxt components), Playwright journeys plus a responsive check

**Target Platform**: Self-hosted Linux containers (unchanged); local dev with `pnpm dev:local` (web 3100, API 3101)

**Project Type**: Web application (pnpm monorepo: `apps/web`, `apps/api`, `packages/shared`)

**Performance Goals**:

- Transactions table: sort, filter and page in < 1 s with 10,000 bookings (SC-003).
- Search: results in < 300 ms with 10,000 bookings (SC-004).
- Both measured with the extended perf script.

**Constraints**:

- Money in integer cents.
- No third-party requests (FR-025, SC-007).
- 360 px without horizontal scroll, dark and light.
- German UI.
- Amounts keep the space before €.
- No private infrastructure details in the public repo.

**Scale/Scope**:

- Single owner.
- ~4 new pages: Sankey, account detail, depot detail, category detail.
- ~6 reworked pages.
- ~15 new or changed endpoints.
- 3 new tables, 1 new column (`category.icon`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template. The working rules from 001/002 apply instead:

| Rule | Status |
|---|---|
| Money as integer cents, half-even rounding | Pass: bulk/aggregate figures reuse `domain/money.ts` |
| Data stays local, no third-party requests | Pass: initials avatars, self-hosted font, local search (R3, R10, R11) |
| Test per layer (domain unit, API e2e, Playwright per story) | Pass: R14 |
| Quality gates before each task commit (lint, format, typecheck, leak guard) | Pass: `done3.sh` flow like 002 |
| No private infrastructure details in the repo | Pass |

Post-design re-check: no violations. Complexity Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/003-reference-parity/
├── spec.md
├── plan.md              # This file
├── research.md          # R1–R14
├── data-model.md
├── quickstart.md        # W1–W12
├── contracts/
│   └── http-api.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks output
```

### Source Code (repository root)

```text
packages/shared/src/
├── category-icons.ts           # icon keys + labels (R8)
└── dto/                        # transactions query/bulk, tags, search, budgets overview, account detail

apps/api/src/
├── database/
│   ├── schema.ts               # + tag, transaction_tag, deleted_import_marker; category.icon
│   ├── migrations/0006_reference_parity.sql
│   └── demo.ts                 # demo tags, icons
├── domain/
│   ├── period-returns.ts       # + trailing periods (1M…Gesamt)
│   ├── budget-history.ts       # budget vs. spending per month
│   └── sparkline.ts            # 30-day balance series per account
└── modules/
    ├── transactions/           # query (filter/sort/page), bulk, delete + undo store + restore, export
    ├── tags/                   # CRUD
    ├── search/                 # GET /search
    ├── accounts/               # + /accounts/overview (sparklines, last sync), /accounts/:id/detail
    ├── budgets/                # + /budgets/overview (12-month series, table rows)
    ├── import/                 # skip deleted_import_marker fingerprints
    ├── analysis/               # + trailing periods
    ├── dividends/              # + split by region/sector
    └── taxes/                  # + Vorabpauschale per broker

apps/web/app/
├── assets/css/main.css         # @font-face Outfit, underline tabs
├── components/
│   ├── common/                 # GlobalSearch, Avatar, CopyButton, Sparkline, DateRangePicker,
│   │                           # CategoryIcon, FilterPanel, SortHeader
│   ├── transactions/           # TransactionsTable, BulkBar, BalanceTile, UnreviewedTile, TagManager
│   ├── accounts/               # AccountGroupCard, AccountRow, AccountDetail
│   └── budget/                 # PeriodPicker, BudgetChart, BudgetTable, CategoryDetail
├── composables/useCategoryAppearance.ts   # one color/icon per category (R9)
└── pages/
    ├── transactions.vue        # full workspace
    ├── accounts/index.vue, accounts/[id].vue, depots/[id].vue
    └── budget/{index,sankey,budgets}.vue, budget/categories/[id].vue, budget/review.vue → redirect

e2e/                            # us-p1…us-p8 journeys, responsive pages
```

**Structure Decision**: Same monorepo layout as 001/002. New behaviour goes into the existing modules where the data lives (transactions, accounts, budgets, import). There are two new small modules, `tags` and `search`.

## Phases

- **Phase 0**: [research.md](./research.md). All decisions are made; no NEEDS CLARIFICATION remains.
- **Phase 1**:
  - [data-model.md](./data-model.md)
  - [contracts/http-api.md](./contracts/http-api.md)
  - [quickstart.md](./quickstart.md)

## Complexity Tracking

None.
