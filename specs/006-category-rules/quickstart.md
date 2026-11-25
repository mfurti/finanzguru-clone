# Quickstart: Category Rules That Learn (006)

Local only (web 3100, API 3101). Gates: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

| # | Story | Steps | Expected |
|---|---|---|---|
| W1 | US1 | Transaktionen → chip of a rent booking → "Miete", scope "Alle Buchungen dieses Empfängers", "merken" on | Toast "n Buchungen geändert, Regel gespeichert"; all uncategorized rent bookings show "Miete"; rule visible under Kategorien & Regeln |
| W2 | US1 | Next bank sync with a rent booking | Arrives as "Miete" (rule) |
| W3 | US1 | Bulk: select 3 Stadtwerke bookings → "Kategorie setzen" → "Strom" + "merken" | One rule created |
| W4 | US2 | Two Telekom bookings → "Handy", "Nur diese Buchung" each | After the second: suggestion "Regel anlegen?"; accept → rule; decline on another pair → never shown again |
| W5 | US3 | Kategorien & Regeln → new rule "Verwendungszweck enthält KLARNA → Shopping" | Preview count before saving; move up/down; switch off |
| W6 | all | 360 px, dark and light | No horizontal scroll, no "NaN" |

Manual categories stay unchanged in all walkthroughs (check one manually set booking before and after).
