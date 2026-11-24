# Research: Broker Sync and Open Follow-ups

## R1 Scalable connection (carried over from 001 R3)

- **Decision**: Keep 001 R3.
  - Scalable's official remote MCP server, OAuth authorization code with PKCE and dynamic client registration.
  - The owner logs in on Scalable's own page.
  - The token set is AES-GCM encrypted.
  - A static allowlist of read tools; any order, trade or transfer tool is blocked.
- **First connection (owner present)**:
  - Record `tools/list` and the read-tool responses, anonymize them into fixtures, and finalize the allowlist.
  - If dynamic client registration is refused, stop. CSV stays the source, and this is reported as a blocker, not a silent fallback.
- **Alternatives**: Community wrappers (unofficial), Scalable's CLI as a subprocess (needs a local CLI login), scraping (rejected).

## R2 Sync run and lock

- **Decision**: A new `sync_run` table (one row per run).
  - An in-process lock per source: a second start returns 409.
  - Status transitions on `data_source`:
    - an expired grant: `active → needs_reauth`;
    - a successful reconnect: back to `active`;
    - an upstream failure: `error`.
  - Imports go through the existing pipeline, so the 001 fingerprints and the 003 deleted-import markers apply.
- **Rationale**: Reuses the dedupe logic. A single process makes an in-memory lock sufficient; `sync_run` keeps the history across restarts.

## R3 Daily sync

- **Decision**: `@nestjs/schedule` with a cron expression, active only when `SCALABLE_DAILY_SYNC=true`. The default is off (FR-006). Missed runs are not caught up.
- **Alternatives**: A server crontab calling the API (needs a token on the server; rejected).

## R4 Asset-class performance chart

- **Decision**: A derived table `instrument_value_snapshot` with `(account_id, instrument_id, date, value_cents, invested_cents)`.
  - It is rebuilt by the existing `RecomputeService` for depots, from positions × prices with the last known price carried forward.
  - `GET /investments/performance?assetClass=` sums the series of the matching instruments.
- **Rationale**: Depot snapshots cannot be split after the fact. A derived table keeps reads fast, like `net_worth_snapshot`.
- **Alternatives**: Compute on request from bookings and prices (slower for 5 years); per-instrument value only for the current date (no history).

## R5 Testing

- **Unit**:
  - the mapper against the anonymized fixtures;
  - `instrument-values.ts`, where the sum over instruments equals the depot snapshot within 1 cent per day.
- **e2e**:
  - the source endpoints with a mocked MCP server (connect URL, callback, sync 202, a second sync 409, an upstream error gives 502, delete keeps data);
  - the performance endpoint by asset class.
- **Playwright**: the Scalable card states (connect, connected, needs re-auth) with a mocked API, and the chart following the chips.
- **Local**: every walkthrough runs against the local dev server. Deployment (001 R18, T079–T083) is planned separately later.

## Live bank data (not in scope, for a later decision)

- **Finding (2026-11-24)**: The reference tool connects banks through licensed account-information services (wealthAPI, finAPI). Banks ask for a renewed PSD2 consent about every 90 days.
- **Self-hosted options**:
  - FinTS PIN/TAN, which needs a free product registration with the Deutsche Kreditwirtschaft (days to weeks).
  - A PSD2 service with a free mode for one's own accounts, e.g. Enable Banking.
  - GoCardless Bank Account Data closed new sign-ups in July 2025.
- **Sources**: finanzfluss.de/copilot/hilfe (ING import), reisetopia.de (Copilot review), actualbudget.org (GoCardless notice), python-fints docs (registration).
