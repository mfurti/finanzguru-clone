# Feature Specification: Owner Review Round – Columns, Navigation, Investments, Budget, Insurance

**Feature Branch**: `18-owner-review-round-columns-navigation-investments-budget-insurance-012`

**Created**: 2026-11-27

**Status**: Draft

**Input**: Owner review on 2026-11-27: 15 points collected by selecting elements in the app ("Spalten wie Finanzfluss", "Übersicht lädt beim Seitenwechsel alles neu", "Kauf/Verkauf farblich", "Buchungen statt Transaktionen", "Dividenden: Werte prüfen, Währungen, Investments und Dividendenerträge fehlen", "Anbieterblock fehlt", "Watchlist näher an Finanzfluss", "Sankey: keine Bögen nach oben, Nicht kategorisiert ganz unten", "Donut größer", "Budget-Block näher an Finanzfluss", "Versicherung – geht das?", "Investments: nur Portfolios wählbar").

**Origin**: The owner's selections in the running app, checked against the reference (looked at only, nothing changed) on 2026-11-27 at 1440 px.

## Findings

| # | Place | Gap found | Reference |
|---|---|---|---|
| P1 | Transaktionen › Spalten | Choice: Datum, Kategorie, Eigenschaften, Konto, Verwendungszweck | Datum, Kategorie, Tags, Eigenschaften, Betrag, Steuern; checked by default Datum, Kategorie, Eigenschaften, Betrag |
| P2 | Investments › Positionen › Spalten | Small dropdown | Side panel "Spalten": "Alle auswählen", one checkbox per column with drag handle to reorder, "Speichern"; columns Aktueller Kurs, Aktueller Wert, Einstiegswert, Kursgewinn, Realisiert €, Transaktionen, Allokation, Dividende |
| P3 | Übersicht (Dashboard, Portfolios & Konten, Transaktionen) | Changing page reloads everything, including the side navigation | Investments/Budget keep the side navigation; Übersicht must behave the same |
| P4 | Investments › Buchungen › Art | Kauf and Verkauf look the same | Small coloured badge above the date: Kauf green, Verkauf blue |
| P5 | Investments side navigation | Item called "Transaktionen" | "Buchungen" |
| P6 | Investments › Dividenden › Entwicklung | Yearly amounts differ from the reference for the same accounts | Reference shows only the owner's real dividends; to be checked |
| P7 | Investments › Dividenden › Aufteilung | Tabs Wertpapiere, Regionen, Branchen | Also Währungen |
| P8 | Investments › Dividenden | Blocks "Investments" (Portfoliowert, Dividenden des Jahres) and "Dividendenerträge" (letzte 12 Monate, Ø pro Monat) missing; app shows four separate tiles | Three cards: Investments, Dividendenerträge, Dividendenrendite (YTD, CAGR) |
| P9 | Investments › Steuern › Freistellungsaufträge | Provider block missing (only "–") | One row per depot/bank: logo, name, Zugeteilt (editable), Ausgeschöpft, progress bar, Verfügbar |
| P10 | Investments › Watchlists | Input field + empty state | Tabs per watchlist plus "Neue Watchlist", "n Wertpapiere", period switch, "Hinzufügen", ⋮ menu, empty state "Noch nichts hinzugefügt" with "Erstes Wertpapier hinzufügen"; a first watchlist exists from the start; navigation item "Watchlist" |
| P11 | Sankey | Flows bend upwards; "Nicht kategorisiert" sits in the middle | First flow straight, every further one only downwards; categories without sub categories (incl. "Nicht kategorisiert") and the balance at the bottom |
| P12 | Budget › Analyse › Kategorien donut | 192 px in a much larger card | Fills the card (about 400 px at 1440 px) |
| P13 | Budget › Budgets (empty) | Separate period card + small empty card | One card: period header with "Aktueller Monat", "Hinzufügen", ⋮; faded month chart behind; centred illustration, "Leg dein erstes Budget an", large "Hinzufügen"; table columns Budgethöhe, Ausgaben, Status, Differenz |
| P14 | Versicherung | Manual contracts only | Reference is a brokerage page (health insurance teaser); no data import from insurers |
| P15 | Investments › Konten-Filter | Offers all accounts | Only portfolios (depots) |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigation and tables behave like the reference (Priority: P1)

The owner moves between Dashboard, Portfolios & Konten and Transaktionen without the side navigation reloading, finds "Buchungen" under Investments, sees buys and sells apart at a glance, chooses table columns like in the reference, and in Investments only picks portfolios.

**Why this priority**: Everyday use; small changes with a large effect.

**Independent Test**: Click through Übersicht, Investments › Buchungen, both column choosers and the account filter in Investments.

**Acceptance Scenarios**:

1. **Given** the Übersicht, **When** the owner switches between its three pages, **Then** the side navigation and header stay in place and only the content changes (P3).
2. **Given** the Transaktionen table, **When** the owner opens "Spalten", **Then** the choice is Datum, Kategorie, Tags, Eigenschaften, Betrag, Steuern with Datum, Kategorie, Eigenschaften, Betrag checked by default (P1).
3. **Given** Positionen, **When** the owner opens "Spalten", **Then** a side panel lists the columns with checkboxes, "Alle auswählen", drag handles to reorder and "Speichern"; the saved choice and order stay after reload (P2).
4. **Given** Investments › Buchungen, **When** the list shows buys and sells, **Then** each row has a coloured Art badge (Kauf green, Verkauf blue, other kinds neutral) and the side navigation says "Buchungen" (P4, P5).
5. **Given** Investments, **When** the owner opens the account filter, **Then** only portfolios are offered (P15).

---

### User Story 2 - Dividends and taxes like the reference (Priority: P1)

The owner sees the same dividend amounts per year as in the reference for the same accounts, the blocks Investments / Dividendenerträge / Dividendenrendite, an Aufteilung with Währungen, and the exemption orders per provider.

**Why this priority**: Wrong figures undermine trust (P6); missing blocks are visible gaps.

**Independent Test**: Same accounts selected in both apps; compare Entwicklung per year; open Aufteilung › Währungen; Steuern shows one provider row per depot.

**Acceptance Scenarios**:

1. **Given** the owner's real accounts, **When** Dividenden › Entwicklung is shown, **Then** every year matches the reference within 0,01 € or the remaining difference is explained (P6).
2. **Given** Dividenden, **When** the page loads, **Then** three cards show Investments (Portfoliowert, Dividenden des Jahres), Dividendenerträge (letzte 12 Monate, Ø pro Monat) and Dividendenrendite (Jahr YTD, CAGR) (P8).
3. **Given** the Aufteilung, **When** the owner picks "Währungen", **Then** dividends are split by the currency of each security (P7).
4. **Given** Steuern › Freistellungsaufträge, **When** the owner has depots or banks with an exemption order, **Then** one row per provider shows logo, name, assigned amount (editable), used amount with bar, and available amount; the total bar sums them (P9).

---

### User Story 3 - Sankey and donut read like the reference (Priority: P2)

**Acceptance Scenarios**:

1. **Given** the Sankey, **When** it is drawn, **Then** no flow bends upwards: the first flow of each column runs straight, further ones only downwards; categories without sub categories ("Nicht kategorisiert") and the balance sit at the bottom (P11).
2. **Given** Budget › Analyse, **When** the categories card is shown at 1440 px, **Then** the donut fills the chart area (about 400 px) with the same look as the other donuts, smaller on narrow screens (P12).

---

### User Story 4 - Watchlist, budgets and insurance closer to the reference (Priority: P3)

**Acceptance Scenarios**:

1. **Given** Investments › Watchlist, **When** opened the first time, **Then** a watchlist "Watchlist" exists; watchlists are tabs with "Neue Watchlist"; the header shows the number of securities, a period switch, "Hinzufügen" and a ⋮ menu (rename, delete); empty state "Noch nichts hinzugefügt" with "Erstes Wertpapier hinzufügen" (P10).
2. **Given** Budget › Budgets without budgets, **When** opened, **Then** one card shows the period header with "Aktueller Monat", "Hinzufügen", ⋮, a faded month chart behind a centred own illustration, "Leg dein erstes Budget an" and a large "Hinzufügen" (P13).
3. **Given** recurring bookings in the category Versicherung, **When** the owner opens Versicherung, **Then** the app suggests contracts (provider, contribution, interval) found in those bookings; one click creates the contract, which can then be completed by hand (P14).

### Edge Cases

- Columns saved for a column that no longer exists: ignored.
- Exemption order without any used amount: bar at 0, available = assigned.
- Provider without logo: initials as today.
- Dividends in a currency without data: "Unbekannt".
- Sankey month where every category has sub categories: unchanged order by amount; a category whose sub categories do not add up to it gets an invisible filler so flows stay straight/downwards.
- Insurance suggestion already turned into a contract or dismissed: not suggested again.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Übersicht pages MUST share one frame so the side navigation does not reload when switching between them.
- **FR-002**: Transaktionen MUST offer the columns Datum, Kategorie, Tags, Eigenschaften, Betrag, Steuern (defaults: Datum, Kategorie, Eigenschaften, Betrag); the choice is remembered.
- **FR-003**: Positionen MUST offer a side panel for columns with select-all, reorder by dragging and save; choice and order are remembered.
- **FR-004**: Investments › Buchungen MUST show the Art as a coloured badge (Kauf green, Verkauf blue, others neutral); the navigation item MUST read "Buchungen".
- **FR-005**: The account filter in Investments MUST list only portfolios.
- **FR-006**: Dividend amounts per year MUST match the reference for the same accounts or the difference MUST be documented.
- **FR-007**: Dividenden MUST show the cards Investments, Dividendenerträge and Dividendenrendite; the Aufteilung MUST include Währungen.
- **FR-008**: Freistellungsaufträge MUST show one row per provider with assigned (editable), used, bar and available amounts.
- **FR-009**: The Sankey MUST draw no upward flows and MUST place categories without sub categories and the balance at the bottom.
- **FR-010**: The budget categories donut MUST fill its chart area responsively, keeping the shared donut look.
- **FR-011**: Watchlists MUST be shown as tabs with a default watchlist, count, period switch, add button, menu and the reference empty state; the navigation item MUST read "Watchlist".
- **FR-012**: The empty Budgets page MUST be one card with period header, faded chart, own illustration, call to action and the four table columns.
- **FR-013**: Versicherung MUST suggest contracts from recurring insurance bookings; accepting creates a contract, dismissing hides the suggestion.
- **FR-014**: No page may scroll sideways at 375, 768 and 1440 px; dark and light mode; German texts.

### Key Entities

- **Column preference**: page key, visible columns, order (per owner).
- **Exemption order**: year, provider (account/institution), assigned amount; used amount derived from booked taxes/exempted income.
- **Watchlist**: name, position (tabs), entries (existing).
- **Insurance suggestion**: counterparty, amount, interval, bookings it is based on, state (open, accepted, dismissed).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 15 points (P1–P15) resolved or, for P6, any remaining difference explained (owner check).
- **SC-002**: Switching between the three Übersicht pages keeps the side navigation element in place (no re-render) in a browser test.
- **SC-003**: Dividend yearly amounts equal the reference within 0,01 € for the owner's accounts, or each difference is documented.
- **SC-004**: Sankey of the owner's current month has zero upward flows (checked by a unit test on the layout and by eye).
- **SC-005**: Zero page-level sideways scroll at 375/768/1440 px (layout guard).

## Assumptions

- Owner amounts never go into the repository (comparison values stay in the git-ignored local audit file).
- The reference's coin illustration is not copied; the app uses its own icon/illustration.
- PLUS-only features of the reference (TWROR column, Eigene Aufteilung, multiple watchlists behind paywall) are offered without paywall where cheap, otherwise left out.
- Insurance data cannot be fetched from insurers; suggestions come only from bank bookings.
- Local only; no deployment.
