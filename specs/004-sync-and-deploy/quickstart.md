# Quickstart: Broker Sync, Deployment and Open Follow-ups

## Gates

```powershell
pnpm lint; pnpm format:check; pnpm typecheck; pnpm test; pnpm test:e2e
```

## Walkthroughs

| # | Story | Steps | Expected |
|---|---|---|---|
| W1 | US1 | Einstellungen › Datenquellen › "Scalable Capital verbinden" (owner logs in at Scalable) | Card shows "Verbunden"; no token visible in any API response |
| W2 | US1 | "Synchronisieren" | Positions and cash match Scalable's app to the cent; last sync time shown |
| W3 | US1 | "Synchronisieren" twice quickly, then 10 times in a row | Second start refused; no duplicate bookings |
| W4 | US1 | Portfolios & Konten › Scalable depot › "Aktualisieren" | Same as W2; "Zuletzt …" updated |
| W5 | US1 | Revoke access at Scalable, sync | Card shows "Neu verbinden"; data unchanged |
| W6 | US2 | `docker compose -f deploy/compose.yaml config` with a dummy `.env`; leak guard over `deploy/` | Valid; no private values |
| W7 | US2 | Rollout on the home server (each step after the owner's OK), then restore yesterday's backup | App reachable in the home network; restore < 10 min |
| W8 | US3 | Investments › chip "ETF" | Chart value = sum of ETF positions in the table; "Alle" equals today's chart |
