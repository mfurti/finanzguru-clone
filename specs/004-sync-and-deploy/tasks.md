# Tasks: Broker Sync, Deployment and Open Follow-ups

**Input**: Design documents from `specs/004-sync-and-deploy/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: Included, per research R6: unit, API e2e, Playwright, and a compose config check.

**Origin**: This file replaces the open tasks of 001 (T054–T058 → US1, T079–T083 → US2) and the T056 deviation of 003 (→ US3).

**Commits**: One commit per task, pushed immediately. The issue checklist is synced. Server steps run only with the owner's explicit OK.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [ ] T001 [P] Add `@nestjs/schedule` to `apps/api/package.json` and register `ScheduleModule.forRoot()` in `apps/api/src/app.module.ts`.
- [ ] T002 [P] Add the zod DTOs from `contracts/http-api.md` to `packages/shared/src/schemas/source.ts`:
  - `sourceDto` with `lastRun`;
  - `syncStarted { runId }`;
  - `connectResponse { authorizationUrl }`.
  - Add the optional `assetClass` to the performance query in `packages/shared/src/schemas/investments.ts`.
- [ ] T003 [P] Add German texts to `apps/web/i18n/locales/de.json`: "Scalable Capital verbinden", "Verbunden", "Neu verbinden", "Synchronisieren", "Verbindung trennen", "Täglich synchronisieren", "Synchronisierung läuft bereits", and "Zuletzt synchronisiert {date}".

---

## Phase 2: Foundational

- [ ] T004 Extend `apps/api/src/database/schema.ts` and generate `apps/api/src/database/migrations/0007_sync_and_history.sql`.
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
- [ ] T005 Add `apps/api/src/modules/sources/sync.service.ts`:
  - an in-process lock per source (a second start throws 409);
  - writes `sync_run` rows;
  - runs the source's `SyncBatch` through the existing import pipeline (fingerprints, deleted-import markers);
  - sets `account.last_synced_at`;
  - applies the status transitions from `data-model.md`.
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
- [ ] T012 [US1] **Owner present.** Run quickstart W1–W5 against the real account and record the results, without personal data, in `specs/004-sync-and-deploy/quickstart.md`.

**Checkpoint**: Scalable depot syncs.

---

## Phase 4: User Story 2 - Run the app on my home server (Priority: P1)

**Goal**: The stack template, backup and gated rollout (former 001 T079–T083).

**Independent Test**: quickstart W6–W7.

- [ ] T013 [P] [US2] Create the server stack template `deploy/compose.yaml` per 001 research R18:
  - `name: finance-clone`;
  - external `${MACVLAN_NETWORK}` and `${PROXY_NETWORK}`, plus a `finance-internal` bridge;
  - `finance-web` (image `ghcr.io/mfurti/finanzguru-clone-web:${FINANCE_TAG:-latest}`, `ipv4_address: ${FINANCE_WEB_IP}`, `mac_address: ${FINANCE_WEB_MAC}`);
  - `finance-api` (internal only, `env_file: .env`, bind mount `./data/api`, healthcheck).
  - Add `deploy/.env.example` with placeholders only. (former 001 T079)
- [ ] T014 [P] [US2] Add `deploy/backup.sh` and `deploy/README.md`.
  - The backup is an SQLite online `.backup` of `data/api/app.db` into `data/api/backup/`. It keeps 7 days, logs to `/var/log/finance-clone-backup.log`, and on a full disk keeps the old backups and exits non-zero.
  - The README covers rollout, update (`docker compose pull && docker compose up -d`), rollback via `FINANCE_TAG`, restore, setting the owner password, and the open decisions (GHCR visibility, HTTPS via the reverse proxy). (former 001 T080)
- [ ] T015 [US2] Check that `release.yml` published both images for the release commit (`gh run list`, GHCR tags), and that `docker compose -f deploy/compose.yaml --env-file deploy/.env.example config` is valid. Add that config check to `.github/workflows/ci.yml`. (former 001 T081)
- [ ] T016 [US2] **Owner's OK per command.** Server rollout:
  - create the stack directory, copy `compose.yaml` and `backup.sh`;
  - the owner writes `.env`;
  - `docker compose config`, `pull`, `up -d`;
  - set the owner password;
  - verify LAN access, and that recreating the containers loses no data;
  - test a restore from a backup.
  - Record the result, without private values, in `deploy/README.md`. (former 001 T082)
- [ ] T017 [US2] **Owner's OK.** Add the crontab line for `backup.sh` and update the server's own documentation and config repository. Check `git diff --cached` for secrets there. Nothing of this goes into this repository. (former 001 T083)

---

## Phase 5: User Story 3 - Performance chart by asset class (Priority: P3)

**Goal**: The asset-class chips filter the chart too (003 T056 deviation).

**Independent Test**: quickstart W8.

- [ ] T018 [P] [US3] Add `apps/api/src/domain/instrument-values.ts`: per depot, instrument and day, the value (quantity × last known close) and invested amount (FIFO cost basis).
  - Unit test in `apps/api/test/unit/instrument-values.spec.ts`: the sum over instruments equals the depot snapshot within 1 cent per day, and prices are carried forward over gaps.
- [ ] T019 [US3] Fill `instrument_value_snapshot` in `apps/api/src/modules/import/recompute.service.ts` alongside `net_worth_snapshot`. Backfill existing data on startup when the table is empty.
- [ ] T020 [US3] Accept `assetClass` on `GET /api/investments/performance` in `apps/api/src/modules/investments/`, summing the matching instruments' series. Add an e2e test in `apps/api/test/e2e/performance-asset-class.e2e-spec.ts`: for each class, the latest value equals the sum of that class's positions.
- [ ] T021 [US3] Make `apps/web/app/components/investments/PerformanceChart.vue` follow `useState('positions-asset-class')`, and show the active class in the card header. Extend `e2e/us-p5-investments.spec.ts`: chip "ETF" changes the chart total to the ETF sum, and "Alle" restores it.

---

## Phase 6: Polish

- [ ] T022 [P] Update `README.md`: the Scalable sync and the deploy folder, with no private values.
- [ ] T023 Run the full gates (`pnpm lint; pnpm format:check; pnpm typecheck; pnpm test; pnpm test:e2e`) and the responsive check, then mark the spec "Implemented".

---

## Dependencies & Execution Order

- **Setup**, then **Foundational** (T004 schema, T005 sync service), then the stories.
- **US1**:
  - T006 needs the owner and blocks T007, which blocks T008 and T012.
  - T009 runs after T005.
  - T010 and T011 run after T008.
- **US2**: independent of US1.
  - T013 and T014 run in parallel, then T015.
  - T016 needs the owner and T015.
  - T017 runs after T016.
- **US3**: independent; T018, then T019, T020, T021.
- **Polish**: last.

## Parallel Examples

```text
T001, T002, T003 together
T013, T014, T018 together (different areas)
```

## Implementation Strategy

- US2 (T013–T015) and US3 can start at once.
- US1 starts when the owner is available for T006.
- Server steps (T016, T017) only run in a session with the owner.
