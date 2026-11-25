# Quickstart: Popups, Tables and Charts Like the Reference (007)

Local only (web 3100, API 3101). Gates: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

| # | Story | Steps | Expected |
|---|---|---|---|
| W1 | US1 | Transaktionen at 1024, 1280, 1440 px | Betrag visible in every row, no horizontal scroll; Konto only after choosing it in Spalten |
| W2 | US1 | Click a booking row | Side panel with all fields; note saved; switch "Als Kontentransfer markieren" changes the type |
| W3 | US1 | Click a category chip | Large window: search "Lebens", expand a group, choose, scope + merken, Speichern |
| W4 | US2 | Filter → Kontobewegungen "ausgehend", Min 10 €, Max 100 € → Ergebnisse anzeigen | Only negative bookings 10–100 €; button shows "2" |
| W5 | US3 | Übersicht at 1440 px | Header row, ⓘ, compact axis, card links, Top/Flop side by side, one-line Ungeprüfte, Kennzahlen grid, reference order |
| W6 | US4 | Budget › Analyse | Boxed figures, two-line month labels with year divider, Sankey card, donut without gaps "Gesamtausgaben" |
| W7 | US5 | + Hinzufügen → "Sparkasse" → choose | "Wie möchtest du importieren?" with Automatisch / Datei hochladen / Manuell |
| W8 | all | 360 px, dark and light; side-by-side with the reference | No horizontal scroll, no "NaN"; the 8 places match in structure |

## T017 result (2026-11-25)

Checked on the local dev server at 1440 px and 360/375 px, light and dark: no horizontal scroll and no "NaN" on Übersicht, Transaktionen, Budget › Analyse, Budget › Sankey, Investments, Datenquellen; booking side panel, category window, filter panel and add window fit on a phone. Found and fixed: category window showed main categories without icon (raw keys instead of the resolved appearance).

Differences left on purpose (structure matches, details differ):

- Booking side panel: initials avatar instead of a bank logo; no "Aus den Statistiken entfernen" and no "Transaktion aufteilen" (own feature).
- Filter panel: Zeitraum as two date fields instead of a calendar with presets; no "Weitere Filter".
- Add window: short static provider list (Sparkasse, Scalable Capital, other bank) without logos; IBAN/BIC search offers the bank connection, not a bank directory.
- Card ⋮ menus only where a card has options (net-worth chart); Holdings keep the range select instead of "1 Tag / Zeitraum" toggle.
