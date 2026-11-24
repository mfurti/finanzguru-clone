# Tasks: Broker Sync and Open Follow-ups

**Input**: Design documents from `specs/004-broker-sync/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: Included, per research R5: unit, API e2e and Playwright, all against a fresh local database or the local dev server.

**Origin**: Replaces the open tasks of 001 US3 (T054–T058 → US1) and the T056 deviation of 003 (→ US2). Deployment (001 T079–T083) is not part of this feature; it gets its own plan after local testing.

**Commits**: One commit per task, pushed immediately. The issue checklist is synced.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 [P] Add `@nestjs/schedule` to `apps/api/package.json` and register `ScheduleModule.forRoot()` in `apps/api/src/app.module.ts`.
- [X] T002 [P] Add the zod DTOs from `contracts/http-api.md` to `packages/shared/src/schemas/source.ts`:
  - `sourceDto` with `lastRun`;
  - `syncStarted { runId }`;
  - `connectResponse { authorizationUrl }`.
  - Add the optional `assetClass` to the performance query in `packages/shared/src/schemas/investments.ts`.
- [X] T003 [P] Add German texts to `apps/web/i18n/locales/de.json`: "Scalable Capital verbinden", "Verbunden", "Neu verbinden", "Synchronisieren", "Verbindung trennen", "Täglich synchronisieren", "Synchronisierung läuft bereits", and "Zuletzt synchronisiert {date}".

---

## Phase 2: Foundational

- [X] T004 Extend `apps/api/src/database/schema.ts` and generate `apps/api/src/database/migrations/0007_sync_and_history.sql`.
  - It must be additive only: `CREATE TABLE` and `CREATE INDEX`.
  - Add `sync_run`:
    - `status` ∈ `running|succeeded|partial|failed`;
    - `imported`/`skipped` ≥ 0;
    - `error` ≤ 500 chars;
    - FK to `data_source` on delete cascade;
    - index `(source_id, started_at)`.
  - Add `instrument_value_snapshot`:
    - PK `(account_id, instrument_id, date)`;
    - index `(instrument_id, date)`;
    - FKs on delete cascade.
  - Write an upgrade test in `apps/api/test/unit/schema-004.spec.ts`. Its journal filter is `entry.tag < '0007'`; do the same in `schema-003.spec.ts`.
- [X] T005 Add `apps/api/src/modules/sources/sync.service.ts`:
  - an in-process lock per source (a second start throws 409);
  - writes `sync_run` rows;
  - runs the source's `SyncBatch` through the existing import pipeline (fingerprints, deleted-import markers);
  - sets `account.last_synced_at`;
  - applies the status transitions from `data-model.md`.
  - Lives in its own `SyncModule` (`apps/api/src/modules/sources/sync.module.ts`), because `ImportModule` already depends on `SourcesModule`.
  - Unit test in `apps/api/test/unit/sync-service.spec.ts` with a fake source: lock, success, partial, upstream error → `error`, expired grant → `needs_reauth`.

---

## Phase 3: User Story 1 - Sync my Scalable Capital depot (Priority: P1) 🎯 MVP

**Goal**: Connect once, then sync positions, bookings and cash without exports (former 001 T054–T058).

**Independent Test**: quickstart W1–W5.

- [ ] T006 [US1] **Owner present.** Connect once to Scalable's real MCP server; the owner completes login and consent personally.
  - Record `tools/list` and the read-tool responses, anonymize them (names, IBANs, amounts scaled), and save them in `apps/api/test/fixtures/scalable-mcp/`.
  - Finalize `apps/api/src/modules/sources/scalable-mcp/allowlist.ts`, which allows read tools only.
  - If dynamic client registration is refused, stop and report the blocker (research R1). (former 001 T054)
- [ ] T007 [US1] Implement `apps/api/src/modules/sources/scalable-mcp/mapper.ts` and `ScalableMcpSource` in `apps/api/src/modules/sources/scalable-mcp/scalable-mcp.source.ts`.
  - The mapper turns tool results into a `SyncBatch` including `positionsSnapshot`, with money in cents.
  - Write contract tests against the fixtures in `apps/api/test/unit/scalable-mapper.spec.ts`. (former 001 T055)
- [ ] T008 [US1] Add these routes to `apps/api/src/modules/sources/sources.controller.ts`:
  - `POST /api/sources/scalable/connect`;
  - `GET /api/sources/scalable/callback`;
  - `POST /api/sources/:id/sync` (202; 409 while running or for CSV; 502 upstream);
  - `DELETE /api/sources/:id` (grant deleted, data kept);
  - `GET /api/sources` (never credentials).
  - A positions mismatch after a sync becomes an import-job warning.
  - Write e2e tests with a mocked MCP server in `apps/api/test/e2e/scalable-sync.e2e-spec.ts`. (former 001 T056)
- [ ] T009 [P] [US1] Add the optional daily sync in `apps/api/src/modules/sources/sync.scheduler.ts`. It is off unless `SCALABLE_DAILY_SYNC=true` (add it to `apps/api/src/config/env.schema.ts`), and missed runs are not caught up. Unit test in `apps/api/test/unit/sync-scheduler.spec.ts`. (former 001 T057)
- [ ] T010 [US1] Make `apps/api/src/modules/accounts/accounts-overview.service.ts` `sync()` delegate to `SyncService` for active sync-capable sources (202), keeping 409 for CSV accounts. Extend `apps/api/test/e2e/accounts-overview.e2e-spec.ts`.
- [ ] T011 [US1] Extend `apps/web/app/pages/settings/sources.vue` with the Scalable card:
  - "Scalable Capital verbinden" redirects to the authorization URL;
  - status badge (Verbunden / Neu verbinden / Fehler);
  - last sync time and last run counts;
  - "Synchronisieren" shows a toast when a sync is already running;
  - "Verbindung trennen" with confirmation;
  - the daily-sync state as read-only info.
  - Write the Playwright test `e2e/us-s1-scalable.spec.ts` with a mocked API via `page.route`. (former 001 T058)
- [ ] T012 [US1] **Owner present.** Run quickstart W1–W5 against the real account and record the results, without personal data, in `specs/004-broker-sync/quickstart.md`.

**Checkpoint**: Scalable depot syncs.

---

## Phase 4: User Story 2 - Performance chart by asset class (Priority: P3)

**Goal**: The asset-class chips filter the chart too (003 T056 deviation).

**Independent Test**: quickstart W6.

- [X] T013 [P] [US2] Add `apps/api/src/domain/instrument-values.ts`: per depot, instrument and day, the value (quantity × last known close) and invested amount (FIFO cost basis).
  - Unit test in `apps/api/test/unit/instrument-values.spec.ts`: the sum over instruments equals the depot snapshot within 1 cent per day, and prices are carried forward over gaps.
- [X] T014 [US2] Fill `instrument_value_snapshot` in `apps/api/src/modules/import/recompute.service.ts` alongside `net_worth_snapshot`. Backfill existing data on startup when the table is empty.
- [X] T015 [US2] Accept `assetClass` on `GET /api/investments/performance` in `apps/api/src/modules/investments/`, summing the matching instruments' series. Add an e2e test in `apps/api/test/e2e/performance-asset-class.e2e-spec.ts`: for each class, the latest value equals the sum of that class's positions.
- [ ] T016 [US2] Make `apps/web/app/components/investments/PerformanceChart.vue` follow `useState('positions-asset-class')`, and show the active class in the card header. Extend `e2e/us-p5-investments.spec.ts`: chip "ETF" changes the chart total to the ETF sum, and "Alle" restores it.

---

## Phase 5: Polish

- [ ] T017 [P] Update `README.md`: the Scalable sync, with no private values.
- [ ] T018 Run the full gates (`pnpm lint; pnpm format:check; pnpm typecheck; pnpm test; pnpm test:e2e`) and the responsive check, test W1–W6 on the local dev server, then mark the spec "Implemented".

---

## Dependencies & Execution Order

- **Setup**, then **Foundational** (T004 schema, T005 sync service), then the stories.
- **US1**:
  - T006 needs the owner and blocks T007, which blocks T008 and T012.
  - T009 runs after T005.
  - T010 and T011 run after T008.
- **US2**: independent; T013, then T014, T015, T016.
- **Polish**: last.

## Parallel Examples

```text
T001, T002, T003 together
T009 and T013 together (different areas)
```

## Implementation Strategy

- US2 can start at once; everything is tested on the local dev server.
- US1 starts when the owner is available for T006.
- Deployment is not part of this feature and gets its own plan after local testing.
