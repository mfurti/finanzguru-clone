# Implementation Plan: Broker Sync and Open Follow-ups

**Branch**: `4-broker-sync` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-broker-sync/spec.md`

## Summary

This feature finishes the work still open from features 001–003, tested locally only. Deployment gets its own plan later:

1. **Scalable Capital sync.** It uses the existing 001 scaffolding (`scalable-mcp/` client, OAuth provider, credential store, allowlist). What is left:
   - the first real connection, made by the owner;
   - the mapper to `SyncBatch`;
   - the source endpoints and the sync lock;
   - the optional daily scheduler;
   - the settings card;
   - the hook-up of "Aktualisieren" from 003.
2. **Asset-class performance chart.** It is driven by a derived per-instrument daily value series.

## Technical Context

**Language/Version**: TypeScript ~5.9.3 on Node.js 26

**Primary Dependencies**:

- Existing: Nuxt 4, Nuxt UI 4, NestJS 11, Drizzle and SQLite.
- `@modelcontextprotocol/sdk` (already in 001 for the Scalable client).
- New: `@nestjs/schedule` for the daily sync (planned in 001 T057).

**Storage**: SQLite (WAL); migration `0007_sync_and_history` (see [data-model.md](./data-model.md))

**Testing**:

- Vitest: the mapper against recorded fixtures, the sync lock, and the asset-class series.
- Nest e2e with a mocked MCP server.
- Playwright for the settings card and the chart chips.

**Target Platform**: Local dev server (`pnpm dev:local`, web 3100, API 3101); deployment is out of scope

**Project Type**: Web application (pnpm monorepo)

**Performance Goals**: A manual sync of 5 years of history in under 1 minute (SC-003); the asset-class chart under 2 s like the other pages.

**Constraints**:

- The owner performs the Scalable login and consent personally.
- The access grant is stored encrypted (AES-GCM, 001 R12).
- Only read tools are used (allowlist, 001 R3).
- No private infrastructure values in the repository, issues or PRs.

**Scale/Scope**: Single owner; 1 new external source, 4 endpoints, 1 scheduler, 1 settings card, 1 chart filter.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution is still the unfilled template. The working rules from 001–003 apply:

| Rule | Status |
|---|---|
| Money as integer cents | Pass: the mapper converts to cents with `domain/money.ts` |
| Data stays local, read-only external sources | Pass: only Scalable read tools; no other new external calls |
| The owner does logins/consents personally | Pass: FR-001, T006 needs the owner |
| Test per layer | Pass: R6 |
| Quality gates and leak guard per commit; test locally first | Pass: `done4.sh` like 003; local dev server only |

Post-design re-check: no violations.

## Project Structure

### Documentation (this feature)

```text
specs/004-broker-sync/
├── spec.md
├── plan.md
├── research.md          # R1–R5
├── data-model.md
├── quickstart.md        # W1–W6
├── contracts/http-api.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
apps/api/src/
├── database/schema.ts, migrations/0007_sync_and_history.sql   # sync_run, instrument_value_snapshot
├── domain/instrument-values.ts                               # per-instrument daily value/invested
├── modules/sources/
│   ├── scalable-mcp/{mapper.ts, scalable-mcp.source.ts}      # + existing client/oauth/allowlist/store
│   ├── sources.controller.ts                                 # connect/callback/sync/delete/list
│   ├── sync.service.ts                                       # lock, run log, status transitions
│   └── sync.scheduler.ts                                     # daily, off by default
├── modules/accounts/accounts-overview.service.ts             # sync() delegates to sync.service
└── modules/investments/                                      # performance?assetClass=
apps/api/test/fixtures/scalable-mcp/                          # anonymized recorded responses
apps/web/app/pages/settings/sources.vue                       # Scalable card
apps/web/app/components/investments/PerformanceChart.vue      # follows the asset-class chips
```

## Phases

- **Phase 0**: [research.md](./research.md)
- **Phase 1**:
  - [data-model.md](./data-model.md)
  - [contracts/http-api.md](./contracts/http-api.md)
  - [quickstart.md](./quickstart.md)

## Complexity Tracking

None.
