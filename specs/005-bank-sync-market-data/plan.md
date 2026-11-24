# Implementation Plan: Bank Sync and Market Data

**Branch**: `5-bank-sync-market-data` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-bank-sync-market-data/spec.md`

## Summary

Four slices on top of feature 004:

1. **Bank sync (US1)**: a new pull source `enable_banking` reads the owner's Sparkasse accounts through Enable Banking (PSD2 account information, restricted production mode). It reuses `SyncService`, `SyncScheduler`, `ImportPipeline` and the AES-GCM credential store from 004. A cross-source match links live bookings to existing CSV rows instead of adding duplicates.
2. **Asset-class chart (US2)**: `instrument_value_snapshot` gains a daily `flow_cents` column. The API returns one series per class (value and TWROR chained from the class's own values and flows). The chart adds lines per chip; the headline and table stay "Alle".
3. **Gain split (US3)**: the existing FIFO state in `domain/positions.ts` already tracks realized gain. The security endpoint exposes `realizedCents` and `priceGainCents`; the page shows both.
4. **Watchlist search and quotes (US4)**: three more read tools from the Scalable MCP connection (`search_securities`, `get_security_quote`, `get_security_chart`) go on the allowlist. A new `MarketDataService` serves search, stores quotes in a `quote` table and price history in `price`, refreshed by a market-hours job.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 22

**Primary Dependencies**: Nuxt 4 + Nuxt UI 4 + Unovis (web); NestJS 11 on Fastify, Drizzle 0.45, better-sqlite3, decimal.js, `@nestjs/schedule`, `@modelcontextprotocol/sdk` (api); zod 4 (shared). New: `jose` for signing Enable Banking JWTs (RS256) — no other new runtime dependency.

**Storage**: SQLite via Drizzle. Migration `0008_bank_sync_market_data` (see [data-model.md](./data-model.md)).

**Testing**: vitest (domain unit, API e2e with Nest `inject`), Vue component tests, Playwright (desktop and 360 px, dark and light). Enable Banking is faked in e2e by overriding an `ENABLE_BANKING_HTTP` provider with recorded, anonymized responses, as done for Scalable in 004.

**Target Platform**: Self-hosted Linux container; developed and verified on the local dev server (web 3100, API 3101).

**Project Type**: pnpm monorepo web application (`apps/web`, `apps/api`, `packages/shared`).

**Performance Goals**: search results < 2 s (SC-006); a bank sync of 90 days < 30 s; class series for 5 years < 500 ms.

**Constraints**: read-only external access; owner-only consent; no secrets in repo; integer cents; German UI from 360 px.

**Scale/Scope**: one owner, 1–3 bank accounts, ≈ 2 000 bookings per year, ≤ 50 watchlist entries.

## Coding Standards

No separate guideline document exists; the effective, enforced standards are:

- **Formatting**: Prettier (`.prettierrc`: no semicolons, single quotes, `printWidth` 100, trailing commas). Check with `pnpm format:check`.
- **Linting**: root `eslint.config.mjs` flat config — `@nuxt/eslint-config` for `apps/web`, `typescript-eslint` recommended for `apps/api` and `packages/shared`, `eslint-config-prettier` last. Check with `pnpm lint`.
- **Types**: `pnpm typecheck` (`vue-tsc` for web, `tsc` for api and shared). No `any` in new code.
- **Tests**: `pnpm test` (vitest) and `pnpm test:e2e` (Playwright, ports 3200/3201).
- **Comments**: a JSDoc block on every new service, component, exported function and non-obvious type, stating intent and the spec/research reference (e.g. `(005 R2)`). Existing comments stay.
- **Vue SFCs**: `<script setup lang="ts">` → `<template>` → `<style scoped>`; component names unique (auto-import without path prefix); `data-testid` on every interactive element used by tests.
- **UI text**: German, only via keys in `apps/web/i18n/locales/de.json`.
- **Contracts**: request and response DTOs as zod schemas in `packages/shared/src/schemas/*`, shared by API and web.
- **API structure**: one Nest module per domain; external providers behind an injectable transport token so tests can fake them.

Every task commit passes `pnpm lint`, `pnpm format:check` and `pnpm typecheck` first (Constitution IV).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Exact Money | Bank amounts parsed from decimal strings to cents (half-even); quotes stored as decimal strings; class values and gain split in cents, gain parts add up exactly (US3) | Pass |
| II. Owner-Controlled, Local Data | Bank consent on Enable Banking/bank pages; only read endpoints called (allowlist of paths); session id and app key encrypted/kept out of DB responses; Scalable read tools added to explicit allowlist; data leaving the server documented in research R1/R6 | Pass |
| III. Public Repo Hygiene | App private key only in git-ignored local config; recorded bank responses anonymized before becoming fixtures; leak guard before commits | Pass |
| IV. Tested by Layer | Domain tests (class TWROR, gain split, cross-source match), API e2e (bank connect/sync/revoke, market data), component tests (search dialog, chart chips), one Playwright journey per story | Pass |
| V. Local First | Verified on local dev server; no deployment tasks | Pass |
| VI. German, Responsive, Honest UI | New dialog and notices in German, 360 px, dark/light, "–" for missing quotes | Pass |
| Security Requirements | Research documents data flow to Enable Banking and Scalable, and the restricted-production registration | Pass |

Post-design re-check (after Phase 1): unchanged, all pass.

## Project Structure

### Documentation (this feature)

```text
specs/005-bank-sync-market-data/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/http-api.md
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks
```

### Source Code (repository root)

```text
packages/shared/src/
├── enums.ts                              # + 'enable_banking' source kind, 'consent_expired' status
└── schemas/
    ├── source.ts                         # bank connection DTOs, consent end date
    ├── investments.ts                    # class series, gain split
    └── market-data.ts                    # search hit, quote, chart point (new)

apps/api/src/
├── database/schema.ts                    # bank_consent, quote, flow_cents
├── database/migrations/0008_bank_sync_market_data.sql
├── domain/
│   ├── class-performance.ts              # per-class value + TWROR chain (new)
│   ├── bank-match.ts                     # cross-source match (new)
│   └── positions.ts                      # expose realized vs price gain
├── modules/sources/
│   ├── enable-banking/
│   │   ├── client.ts                     # JWT-signed HTTP client, path allowlist
│   │   ├── enable-banking-connection.service.ts
│   │   ├── enable-banking.source.ts
│   │   └── mapper.ts
│   ├── scalable-mcp/allowlist.ts         # + search/quote/chart tools
│   ├── sync.controller.ts                # bank connect/callback routes
│   └── sync.scheduler.ts                 # bank daily sync flag
├── modules/market-data/                  # new module
│   ├── market-data.controller.ts
│   ├── market-data.service.ts
│   └── quote.scheduler.ts
├── modules/investments/investments.service.ts   # class series, gain split
└── scripts/enable-banking-record.ts      # records raw responses to git-ignored folder

apps/web/app/
├── components/import/BankCard.vue        # connect, consent notice, Trennen
├── components/investments/PerformanceChart.vue  # chips add lines
├── components/watchlists/AssetSearchDialog.vue  # new
├── components/watchlists/WatchlistTable.vue     # quote, change, time, sparkline
├── pages/investments/[instrumentId].vue  # Realisiert + Kursgewinn
└── pages/settings/sources.vue

apps/api/test/
├── unit/{class-performance,bank-match,enable-banking-mapper,gain-split}.spec.ts
├── e2e/{bank-sync,market-data}.e2e-spec.ts
└── fixtures/enable-banking/*.json        # anonymized

apps/web/tests/{bank-card,asset-search,class-chart}.spec.ts

e2e/{us-b1-bank-sync,us-b2-class-chart,us-b3-gain-split,us-b4-watchlist-search}.spec.ts
```

**Structure Decision**: Existing monorepo layout. Bank sync is another pull source next to Scalable inside `modules/sources`; market data gets its own module because it is not an import source.

## Complexity Tracking

No violations.
