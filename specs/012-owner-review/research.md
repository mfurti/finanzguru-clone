# Research: Owner Review Round (012)

## R1 – Übersicht frame (P3)

- **Decision**: a parent route for the Übersicht pages, like `pages/investments.vue`, rendering `SectionNav` once and the child page in `<NuxtPage>`; URLs stay `/`, `/accounts`, `/transactions` (aliases or a route group with a parent).
- **Rationale**: Investments/Budget already behave this way; a shared parent keeps the navigation mounted.
- **Alternatives**: a Nuxt layout per section (works, but mixes with the app layout and page transitions).

## R2 – Booking columns (P1)

- **Decision**: chooser offers Datum, Kategorie, Tags, Eigenschaften, Betrag, Steuern; Tags = tag chips (today shown under "Eigenschaften"), Eigenschaften = small icons for transfer, excluded from statistics, note, split; Steuern = tax amount of the booking ("–" when none). Konto and Verwendungszweck leave the chooser (visible in the booking side panel). Stored choices map old keys; defaults Datum, Kategorie, Eigenschaften, Betrag.

## R3 – Columns panel (P2)

- **Decision**: `USlideover` "Spalten" with "Alle auswählen", one row per column (checkbox, label, drag handle; HTML5 drag and drop plus move up/down buttons for keyboard), "Speichern"; choice and order stored per table in local storage. Columns: Aktueller Kurs, Aktueller Wert, Einstiegswert, Kursgewinn, Realisiert €, Transaktionen (count), Allokation, Dividende.

## R4 – Dividend difference (P6)

- **Decision**: compare per year with the owner's real accounts only (demo accounts excluded via the account filter) using the local audit script; fix the cause in the dividend domain (likely candidates: demo/other accounts included, gross vs. net, reinvested or accumulated distributions, pay date vs. ex date). Values stay in `apps/api/data/audit-012-local.md` (git-ignored).

## R5 – Dividend cards and currencies (P7, P8)

- **Decision**: summary gains `portfolioValueCents` (current value of the selected depots), `yearCents` (dividends of the current year) and `byCurrency` (bucket per security currency, "Unbekannt" when missing). Cards: Investments (Portfoliowert, Dividenden <Jahr>), Dividendenerträge (letzte 12 Monate, Ø pro Monat), Dividendenrendite (<Jahr> YTD, CAGR).

## R6 – Exemption providers (P9)

- **Decision**: rows for every institution that has a depot or an exemption order in the year; assigned = exemption order amount (inline edit via existing API, 0 when none); used = exempted capital income booked at that institution in the year (same rule as today's total); available = assigned − used, not below 0.

## R7 – Sankey without upward flows (P11)

- **Decision**: in `sankeyOrder`, mains with sub categories first (by amount), then mains without sub categories (by amount, "Nicht kategorisiert" included), then the balance; for a main whose sub categories sum to less than the main, add an invisible filler sub node (no label, no tooltip, not in the block list) carrying the rest.
- **Rationale**: with layout iterations 0 ECharts stacks each column from the top; when every main is fully split into subs, every sub block starts at or below its main, so flows go straight or down (the reference behaviour).
- **Alternatives**: fixed positions via `localX/localY` (block heights are scaled by ECharts and would no longer line up).

## R8 – Responsive donut (P12)

- **Decision**: `DonutChart` `responsive` prop: size from the container width (ResizeObserver), capped at 400 px, ring = 12,5 % of the diameter, centre text one step larger above 300 px; used by the budget categories card.

## R9 – Watchlist like the reference (P10)

- **Decision**: tabs per watchlist plus "Neue Watchlist"; default "Watchlist" created when none exists; header "n Wertpapiere", period switch (1W…All-time), "Hinzufügen" (existing asset search), ⋮ (umbenennen, löschen); empty state "Noch nichts hinzugefügt" / "Erstes Wertpapier hinzufügen".

## R10 – Budgets empty state (P13)

- **Decision**: one card: period header (arrows, month picker, Aktueller Monat, Hinzufügen, ⋮), month chart with zero line faded behind, own illustration (lucide piggy bank / coins icon in a circle, not the reference artwork), "Leg dein erstes Budget an", large "Hinzufügen". With budgets: table Budgethöhe, Ausgaben, Status, Differenz.

## R11 – Insurance suggestions (P14)

- **Decision**: bookings in the main category Versicherung (and its subs) of the last 18 months, grouped by normalized counterparty; a group with ≥ 2 payments whose gaps are ~1, 3, 6 or 12 months (±7 days) and amounts within ±10 % becomes a suggestion (provider, last amount, interval, type from the sub category). Accepting creates a contract (existing API); dismissing stores the group key.
- **Rationale**: insurers offer no open data; bank bookings are what the app has. The reference itself only offers a health insurance teaser.
