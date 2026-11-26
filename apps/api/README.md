# api

NestJS 11 (Fastify) backend of Vermögenskompass. Design: `specs/001-wealth-tracker-dashboard/plan.md`, endpoints: `contracts/http-api.md` (Swagger at `/api/docs` outside production).

## Layout

| Path                              | What                                                                                                                                                                                                                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main.ts`, `src/app.setup.ts` | Bootstrap: `/api` prefix, pino logger, helmet, sealed session cookie, multipart (20 MB), zod validation, error filter, Swagger                                                                                                                                                            |
| `src/config/env.schema.ts`        | Validated environment (see `.env.example`)                                                                                                                                                                                                                                                |
| `src/common`                      | Session guard, `@Public()`, error filter, AES-256-GCM `CryptoService`                                                                                                                                                                                                                     |
| `src/domain`                      | Pure logic with unit tests: money (cents, decimal.js), periods, FIFO positions, snapshots, TWROR/XIRR, dedupe, categorization, cashflow; feature 002: breakdown (largest remainder), volatility, period returns, dividends, exemption orders, Vorabpauschale, benchmark series            |
| `src/database`                    | Drizzle schema, migrations (applied on startup), default seed, demo and perf datasets                                                                                                                                                                                                     |
| `src/modules`                     | Feature modules: auth, overview, accounts, transactions, import, investments, cashflow, categories, budgets, insurance, health; feature 002: analysis (breakdowns, returns, groupings, inflation), instruments (create, prices, classification), dividends, taxes, benchmarks, watchlists |
| `src/modules/sources`             | Data source adapters: CSV (Sparkasse, Scalable, Kursliste, mapped), Scalable MCP (read-only allowlist, OAuth PKCE), Sparkasse live query (planned)                                                                                                                                        |
| `src/scripts`                     | `migrate`, `seed` (`--demo`), `set-password`, `perf`                                                                                                                                                                                                                                      |

## Scripts

| Command                                    | What                                                            |
| ------------------------------------------ | --------------------------------------------------------------- |
| `pnpm --filter api dev`                    | Watch mode (`dev:local` uses `API_PORT=3101` from `.env`)       |
| `pnpm --filter api test`                   | Vitest: unit + e2e via Fastify `inject()` on in-memory SQLite   |
| `pnpm --filter api db:generate`            | New migration from schema changes (drizzle-kit)                 |
| `pnpm --filter api db:migrate` / `db:seed` | Apply migrations / seed categories (`-- --demo` adds demo data) |
| `pnpm --filter api owner:set-password`     | Set the owner login (`OWNER_PASSWORD` or prompt, min 12 chars)  |
| `pnpm --filter api perf`                   | Load test on a temporary DB                                     |

## Database

- SQLite via Drizzle ORM and `better-sqlite3`; file path from `DATABASE_PATH`.
- Pragmas: `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000` (`src/database/open-database.ts`).

### `better-sqlite3` on Node 26 (research R2)

Verified on 2026-11-23:

- Windows 11, Node v26.13.0, `better-sqlite3` 13.2.0: installs and loads (SQLite 3.54.1).
- Docker image `node:26-bookworm-slim`: see the api Dockerfile; the build stage has `python3 make g++`
  as a fallback when no prebuilt binary matches.
