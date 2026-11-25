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
