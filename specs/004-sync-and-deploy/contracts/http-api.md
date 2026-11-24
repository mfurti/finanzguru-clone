# HTTP API Contract: Broker Sync and Asset-Class Chart

- All routes are under `/api` and need the owner session.
- Credentials and grants never appear in any response.

## Sources

| Method | Path | Body / Query | Response |
|---|---|---|---|
| GET | `/sources` | – | `{ id, kind, status, displayName, lastSyncAt, lastError, lastRun?: { status, imported, skipped, finishedAt } }[]` |
| POST | `/sources/scalable/connect` | – | `{ authorizationUrl }`; 502 if registration is refused |
| GET | `/sources/scalable/callback` | `code, state` | 302 to `/settings/sources?connected=scalable` (or `?error=…`) |
| POST | `/sources/:id/sync` | – | 202 `{ runId }`; 409 while running; 409 for CSV sources; 502 upstream error |
| DELETE | `/sources/:id` | – | 204; grant deleted, status `disabled`, data kept |

## Accounts (003, now live)

| Method | Path | Change |
|---|---|---|
| POST | `/accounts/:id/sync` | delegates to `/sources/:sourceId/sync` for sync-capable sources (202), 409 otherwise |
| GET | `/accounts/overview` | `canSync` true for an active Scalable source; `lastUpdateKind: 'sync'` |

## Investments

| Method | Path | Change |
|---|---|---|
| GET | `/investments/performance` | optional `assetClass` (ASSET_CLASSES); the series and totals cover only matching instruments |
