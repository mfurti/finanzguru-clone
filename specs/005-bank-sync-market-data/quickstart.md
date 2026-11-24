# Quickstart: Bank Sync and Market Data (005)

Local only. Dev server: web 3100, API 3101 (see README). Deployment is a separate plan.

## Prerequisites

- Owner logged in on the local app.
- Scalable connected (feature 004) for W4–W5.
- For W1–W2: the owner has registered a restricted-production application at Enable Banking, linked their own Sparkasse account there, and set `ENABLE_BANKING_APP_ID` and `ENABLE_BANKING_KEY_FILE` in the git-ignored local env. The key file stays outside the repo.

## Automated gates

```powershell
pnpm lint; pnpm format:check; pnpm typecheck
```

```powershell
pnpm test
```

```powershell
pnpm test:e2e
```

## Walkthroughs

| # | Story | Steps | Expected |
|---|---|---|---|
| W1 | US1 | Datenquellen → "Bank verbinden" → choose Sparkasse → log in at the bank → back in the app | Bank card active, accounts listed with masked IBAN, consent end date shown |
| W2 | US1 | "Aktualisieren" twice; compare with online banking | Balance equal to the cent; 2nd run 0 new; no duplicates of CSV bookings in the overlap period |
| W3 | US1 | "Trennen" | Card disconnected, bookings and accounts still there |
| W4 | US2/US3 | Investments → chips "Aktien" + "ETF"; € and % view; open a partly sold security | Extra lines; headline unchanged; sold class flat in %; Realisiert + Kursgewinn = GuV |
| W5 | US4 | Watchlist → "Asset suchen" → "Apple" → chip "Aktien" → add | Entry with price, change and quote time; chart visible; adding again refused |
| W6 | all | Repeat W4–W5 at 360 px, dark and light | No horizontal scroll, no "NaN" |

Consent-expiry notice (R4) and the revoked-consent path are covered by API e2e tests with a faked clock.
