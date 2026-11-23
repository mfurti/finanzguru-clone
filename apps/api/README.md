# api

NestJS 11 (Fastify) backend of the wealth tracker. See `specs/001-wealth-tracker-dashboard/plan.md`.

## Database

- SQLite via Drizzle ORM and `better-sqlite3`; file path from `DATABASE_PATH`.
- Pragmas: `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000` (`src/database/open-database.ts`).

### `better-sqlite3` on Node 26 (research R2)

Verified on 2026-11-23:

- Windows 11, Node v26.13.0, `better-sqlite3` 13.2.0: installs and loads (SQLite 3.54.1).
- Docker image `node:26-bookworm-slim`: see the api Dockerfile; the build stage has `python3 make g++`
  as a fallback when no prebuilt binary matches.
