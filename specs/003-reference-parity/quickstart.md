# Quickstart: Reference Parity validation

## Prerequisites

- Run `pnpm install`, then `pnpm --filter api db:migrate` (applies 0006), then `pnpm --filter api db:seed` (demo data).
- Start the dev server with `pnpm dev:local` (web http://localhost:3100, API 3101). Log in with the local dev login (git-ignored file, see 001 quickstart).

## Gates

```powershell
pnpm lint; pnpm format:check; pnpm typecheck; pnpm test; pnpm e2e
```

## Walkthroughs

| # | Story | Steps | Expected |
|---|---|---|---|
| W1 | US1 | Übersicht › Transaktionen, "Nur ungeprüfte anzeigen" | Table shows only unreviewed rows; the tile count matches the total |
| W2 | US1 | Select 2 rows → Kategorie "Lebensmittel" | Both rows updated and reviewed; the count drops by 2 |
| W3 | US1 | Delete 1 row → "Rückgängig" within 10 s | The row returns; after 10 s without undo it is gone, and a re-import of the demo CSV does not bring it back |
| W4 | US1 | Hide column "Konto", filter Typ=Ausgabe, Export | The CSV has the visible columns and the filtered rows only |
| W5 | US1 | Open `/budget/review` | Redirects to Transaktionen with the unreviewed filter |
| W6 | US2 | Portfolios & Konten, copy the IBAN of the demo Girokonto, open it | Clipboard has the full IBAN; the detail page shows history and only its bookings |
| W7 | US3 | Budget › "Aktueller Monat", dropdown "September 2026", Sankey, click "Wohnen" | Range "01.09. – 30.09."; the table lists only Wohnen bookings in September |
| W8 | US3 | Change the color/icon of "Wohnen" in Settings | List, donut, Sankey and detail show the same color and icon |
| W9 | US4 | Budgets 500 € + 900 €, Budgets page | Gesamtbudget 1.400 €; overrun rows red with negative Differenz |
| W10 | US5 | Positionen sort by Kursgewinn, copy ISIN, legend "ETF"; Analyse "Zeiträume"; Dividenden "Regionen" | Order toggles; filter applies to chart and table; trailing rows shown; region split sums to the total |
| W11 | US6/US7 | Net-worth range 01.03.–30.06.2026; Ctrl+K "Giro" | Chart covers the range only; account found in < 300 ms |
| W12 | US8 | DevTools → computed font; Network tab on every page | `Outfit`; no third-party host requested |

## Performance

`pnpm --filter api perf` with 10,000 bookings:

- Transactions query p95 < 1 s.
- Search p95 < 300 ms.

## Responsive

`pnpm e2e responsive` covers the new pages at 360 px in dark and light: no horizontal scroll and no "NaN".
