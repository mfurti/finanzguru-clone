# Quickstart: Broker Sync and Open Follow-ups

All walkthroughs run against the local dev server (`pnpm dev:local`, web http://localhost:3100, API 3101).

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
| W6 | US2 | Investments › chip "ETF" | Chart value = sum of ETF positions in the table; "Alle" equals today's chart |

## Results (2026-11-24, local dev server, owner's real Scalable account)

| # | Result |
|---|---|
| W1 | Connected after the owner enabled "Agentic Investing" (MCP) in Scalable's security settings; no token in any API response. First attempt was refused by Scalable with a clear reason; the app now shows it. |
| W2 | First sync: 154 bookings imported, depot + reference account created. Held quantity equals Scalable's holdings exactly; cash balance equals Scalable's cash to the cent. Depot value differs by 2,02 € from Scalable's overview (holdings priced at the quote's mid price, Scalable values at its own valuation time). |
| W3 | Second and third sync: 0 imported, 154 skipped; no duplicates. |
| W4 | "Aktualisieren" in Portfolios & Konten starts the same sync (0 new, 154 skipped). |
| W5 | Not run: needs revoking the access at Scalable. Covered by tests (expired grant → "Neu verbinden", data kept). |
| W6 | Asset-class chips filter the performance chart (Playwright `us-p5-investments`). |
