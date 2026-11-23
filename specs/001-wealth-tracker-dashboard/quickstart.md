# Quickstart & Validation: Personal Wealth Tracker Dashboard

## Prerequisites

- Node.js 26.x (`node -v` → `v26.*`), pnpm ≥ 10 (`corepack enable`)
- Windows: build tools available in case `better-sqlite3` compiles from source (see research R2)
- Optional: a Scalable Capital account for US3; Sparkasse and Scalable CSV exports for US2

## Setup

```powershell
pnpm install
Copy-Item apps/api/.env.example apps/api/.env   # API_SESSION_SECRET (≥32 bytes), API_ENCRYPTION_KEY (32-byte base64), PORT=3001
Copy-Item apps/web/.env.example apps/web/.env   # API_BASE_URL=http://localhost:3001
pnpm --filter api db:migrate
pnpm --filter api db:seed                       # default categories (+ demo dataset with --demo)
pnpm --filter api owner:set-password
pnpm dev                                        # api :3001 + web :3000 in parallel → http://localhost:3000
```

## Local dev server (testing, no Docker)

Fixed ports so it never collides with other local projects: web `3100`, API `3101`.

```powershell
pnpm --filter api db:seed -- --demo      # once: demo data into apps/api/data/app.db
pnpm --filter api owner:set-password     # once: local login
pnpm dev:local                           # http://localhost:3100 (API on API_PORT=3101)
```

`apps/api/.env` sets `API_PORT=3101` and `apps/web/.env` sets `NUXT_API_BASE_URL=http://localhost:3101`. In the Claude Code desktop app the same server starts from `.claude/launch.json` (configuration `app`).

## Quality gates

```powershell
pnpm lint
pnpm typecheck
pnpm test          # Vitest in all workspaces: domain, parsers, Nest e2e (Fastify inject), components
pnpm test:e2e      # Playwright: desktop + 360 px
```

All four must pass before each task commit.

## Local container test (before every deploy)

```powershell
docker compose -f compose.local.yaml up -d --build   # http://localhost:3000
docker compose -f compose.local.yaml exec finance-api node dist/scripts/set-password.js
docker compose -f compose.local.yaml down
```

Run V1, V5, V12 and V19 against the containers. Deploy only after this passes.

## Server rollout (each server command only after the owner's OK)

See `deploy/README.md`: copy `deploy/compose.yaml` and `deploy/.env.example` to `<STACK_DIR>/`, fill `.env` on the server, `docker compose pull`, `docker compose up -d`, set the owner password, open `http://${FINANCE_WEB_IP}:3000`.

## Validation scenarios

| # | Story | Steps | Expected |
|---|-------|-------|----------|
| V1 | US2 | Log in → Einstellungen › Datenquellen → upload `apps/api/test/fixtures/csv/sparkasse-camt-v8.csv` | Format `sparkasse-camt-v8` detected; job `succeeded`; counts match fixture README |
| V2 | US2 | Upload the same file again | `imported = 0`, `skipped = n` (SC-003) |
| V3 | US2 | Upload `malformed.csv` | Job `partial`; errors list line numbers + reasons ([csv-formats.md](./contracts/csv-formats.md#row-errors)) |
| V4 | US2 | Upload `unknown-layout.csv` | Column mapper appears; mapping saved; re-upload auto-detects it |
| V5 | US1 | `pnpm --filter api db:seed --demo`, open `/` | All 8 widgets filled; Gesamtvermögen = Σ depot values + Σ cash (to the cent) |
| V6 | US1 | Switch 1W…All-time, Vermögen/Rendite, account filter | Chart, totals, KPIs update; no `NaN` |
| V7 | US1 | Compare KPIs with `apps/api/test/fixtures/returns-reference.xlsx` | TWROR/IRR within 0.01 pp (SC-007) |
| V8 | US4 | `/investments` → filter ETF, hide a column, Export | Table/totals update; CSV contains the visible columns only |
| V9 | US5 | `/budget` → Monat/Quartal/Jahr, step back | Figures and 12 bars update; Sankey totals = income |
| V10 | US5 | Categorize an unreviewed row with "Regel speichern" | Count drops by ≥ 1; matching rows are auto-categorized on the next import |
| V11 | US5 | Create budget Lebenshaltung 500 € | Overview budget widget shows spent / remaining |
| V12 | US6 | `/insurance` → add Risiko-Lebensversicherung 23,62 € monthly | Listed with yearly cost 283,44 € |
| V13 | US3 | Datenquellen → "Scalable Capital verbinden" → log in on Scalable's page yourself → Synchronisieren | Positions + reference account match Scalable app (SC-004); `tool_manifest` shows only allowlisted read tools used |
| V14 | US3 | Revoke the token at Scalable (or expire it) → Synchronisieren | Status `needs_reauth`, data unchanged |
| V15 | US7 | Datenquellen | Sparkasse (Live-Abfrage) shown as "geplant", not activatable |
| V16 | All | Playwright at 360 px and in dark/light | No horizontal scroll on any tab (SC-006) |
| V17 | Perf | Seed 5 y daily history + 10k tx, load `/` | Fully rendered < 2 s (SC-002) |
| V18 | API | Open `http://localhost:3001/api/docs`; call `GET /api/overview/kpis` without a cookie | Swagger lists all endpoints from [http-api.md](./contracts/http-api.md); request returns 401 |
| V19 | Docker local | `compose.local.yaml` up, import a CSV, `down`, `up` again | Data still present (bind mount `./data-local/api`); both healthchecks `healthy` |
| V20 | Release | Push to `main` | `release.yml` publishes `finanzguru-clone-web` and `-api` with `latest` + `sha-*` tags to GHCR |
| V21 | Server | On the server: `docker compose -f <STACK_DIR>/compose.yaml config` | Valid; order `name`, `networks`, `services`; only bind mounts; `${FINANCE_WEB_IP}` + fixed MAC on the macvlan network |
| V22 | Server | After `pull` + `up -d`: open `http://${FINANCE_WEB_IP}:3000` from the LAN; recreate containers | Login works; data unchanged after recreation (SC-008) |

## Performance results (T075)

Run `pnpm --filter api perf`. It seeds a temporary DB (5 years of daily prices for 10 ETFs, 10,600 transactions), times every API call of the overview page one after another, then uploads and imports a generated 50,000-row Sparkasse CSV. Exit code 1 if a target is missed.

Measured 2026-11-23 on the development machine (Node 26, SQLite WAL):

| Measurement | Result | Target |
|---|---|---|
| Overview API calls (10 requests, sequential) | 86 ms total; slowest `kpis?period=1Y` 43 ms | page < 2 s (SC-002) |
| CSV import 50,000 rows (upload + confirm + recompute) | 11.6 s | < 30 s |
| Seed 10,600 transactions + 13,050 prices | 1.5 s | – |

Existing indexes (`transactions(account_id, booking_date)`, `transactions(category_id)`, `position_lot(account_id, instrument_id)`, primary keys on `price` and `net_worth_snapshot`) cover the hot queries; no new index was needed.

## Security checks (T076)

- API: `@fastify/helmet` (nosniff, frame options, HSTS, no `x-powered-by`); production adds a deny-all CSP. Covered by `apps/api/test/e2e/security.e2e-spec.ts`, which also checks that `/api/sources` never returns credentials, `/api/auth/session` never returns the password hash, and uploads over 20 MB return 400.
- Web: production responses carry a same-origin CSP plus `X-Frame-Options: DENY`, `Referrer-Policy` and `Permissions-Policy` (`nuxt.config.ts`). Checked against `node .output/server/index.mjs`: all pages render with no CSP violations in the console.
- Logs: pino redacts cookies, the authorization header and `set-cookie`.
- `pnpm audit --audit-level high`: no high or critical findings (3 moderate on 2026-11-23).

Contracts: [http-api.md](./contracts/http-api.md), [data-source.md](./contracts/data-source.md), [csv-formats.md](./contracts/csv-formats.md). Entities: [data-model.md](./data-model.md).
