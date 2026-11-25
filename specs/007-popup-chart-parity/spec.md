# Feature Specification: Popups, Tables and Charts Like the Reference

**Feature Branch**: `7-popup-chart-parity`

**Created**: 2026-11-25

**Status**: Draft

**Input**: User description: "UI-Parität Popups, Tabellen, Legenden und Diagramme (Vermögenskompass ↔ Finanzfluss Copilot, Vergleich 2026-11-25 bei 1440 px) … A) Kategorie-Popup … B) Transaktionen-Tabelle: Betrag-Spalte rutscht aus dem Bild … C) Buchungs-Detail … D) Filter … E) Hinzufügen … F) Dashboard-Diagramm … G) Dashboard-Karten … H) Einnahmen & Ausgaben / Budget-Analyse … Nicht im Umfang: Werbung/PLUS, Teilen, Sankey-Editor, Transaktion aufteilen, Deployment, Bank-Anbieter-Suche über mehrere Banken."

## Overview

The owner compared the app with the reference app side by side on 2026-11-25 at 1440 px. The owner also reported two direct gaps: the category window is too small, and the amount is missing in the Transaktionen table.

| # | Place | Reference | App today |
|---|---|---|---|
| A | Change category | Large window: search, "Neue Kategorie erstellen", Alle / Eigene Kategorien, expandable main categories with icons and their sub-categories, Speichern | Small dropdown on the chip, then a second dialog for scope and "merken" (006) |
| B | Transaktionen table | Columns Name, Datum, Kategorie, Eigenschaften, Betrag; column choice Datum, Kategorie, Tags, Eigenschaften, Betrag, Steuern; name without purpose line | Extra Konto column and purpose line; the table (1 240 px) is wider than its box (1 116 px), so **Betrag is cut off** |
| C | Booking detail | Side panel on row click: logo, name, amount, date; Konto with bank and BIC; Kategorie (opens A); Details An / IBAN / Verwendungszweck; Betrag; Datum; Transaktionstyp; switches "Als ungeprüft markieren", "Aus den Statistiken entfernen", "Als Kontentransfer markieren"; Tags; Notizen; "Transaktion löschen" | None |
| D | Filter | Side panel on the right: Konten, Art der Transaktion, Zeitraum (picker), Kategorie, Tags, Kontobewegungen (ein-/ausgehend), Min/Max Betrag, "Ergebnisse anzeigen" | Small popover: Status, Typ, Kategorien, Von/Bis, Betrag |
| E | Hinzufügen | Large window "Was möchtest du hinzufügen?" with tabs Anbieter / Assets, search by name, IBAN or BIC, popular providers, "Anbieter manuell hinzufügen", then "Wie möchtest du importieren?" (Automatisch, Datei hochladen, Manuell) | Small menu: CSV importieren, Konto anlegen, Transaktion erfassen |
| F | Net-worth chart | One row: tabs Vermögen/Rendite left, periods + calendar + menu right; headline with ⓘ at Gesamtvermögen and Gewinn; "Vergleichen mit" right of the headline; line without fill; compact axis (5K €) | Periods in a second row, filled area, axis "20.000 €", no ⓘ |
| G | Dashboard cards | Titles as links with "›" (Aufteilung, Portfolios & Konten, Holdings, Einnahmen & Ausgaben, Budgets); card menu ⋮; Aufteilung €/% below right of the donut; Holdings Top and Flop side by side; Ungeprüfte as one-line tile; Kennzahlen TWROR/IZF/Inflation/Realrendite as 2-column grid with value right; order left Aufteilung, Kennzahlen, Holdings – right Portfolios & Konten, Ungeprüfte, Einnahmen & Ausgaben, Budgets | Titles without links, Top/Flop stacked, Ungeprüfte as list of 3, Kennzahlen values below labels, different order |
| H | Einnahmen & Ausgaben, Budget › Analyse | Compact bar chart, month labels in two lines with a year divider; Einnahmen/Ausgaben/Saldo in a bordered grid, Gespart/Sparquote in their own box; Analyse also shows a Sankey card (€/%); category donut without gaps, centre label "Gesamtausgaben" | Taller chart, figures free-standing, Sankey only on its own page, donut with gaps, label "Gesamt" |

Not in scope: advertising/PLUS, Teilen, Sankey editor, splitting a booking (own feature), several bank providers (concept "Mehrere Anbieter"), deployment.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Work through bookings like in the reference (Priority: P1)

As the owner, I see the amount of every booking without scrolling sideways. I click a booking to see all its details in a side panel, and I change its category in a large window where I find categories quickly and decide right there whether it applies to this recipient and should be remembered.

**Why this priority**: The amount is missing today; categorizing is the most frequent task.

**Independent Test**: At 1440 px and at 360 px, open Transaktionen: Betrag is visible in every row. Click a row: the side panel shows all fields. Change the category in the large window with search, scope and "merken" in one step.

**Acceptance Scenarios**:

1. **Given** Transaktionen at 1024 px or wider, **Then** the columns Name, Datum, Kategorie, Eigenschaften and Betrag are visible without horizontal scroll; Konto and purpose are optional columns (off by default).
2. **Given** the column menu, **Then** it offers Datum, Kategorie, Tags, Eigenschaften, Konto, Verwendungszweck and Betrag; the choice is remembered.
3. **Given** a click on a row (not on the checkbox or chip), **Then** a side panel opens with: avatar, name, signed amount, date; account with bank; category (opens the category window); recipient, IBAN, purpose; transaction type; switches "Als ungeprüft markieren" and "Als Kontentransfer markieren"; tags; notes; "Transaktion löschen".
4. **Given** the category window, **Then** it shows a search field, the tabs "Alle" and "Eigene Kategorien", all main categories with icon, expandable to their sub-categories, the current category marked, "Neue Kategorie erstellen", and below the list the 006 options (scope, "Für ähnliche Buchungen merken"); one "Speichern" applies everything.
5. **Given** the side panel, **When** the owner edits notes or switches, **Then** the change is saved and the table row updates.

---

### User Story 2 - Filter in a side panel (Priority: P2)

As the owner, I open the filter as a side panel with all filters of the reference and apply them with "Ergebnisse anzeigen".

**Independent Test**: Filter by account, category, tag, "nur ausgehend" and amount 10–100 €: the table and the count show only matching bookings.

**Acceptance Scenarios**:

1. **Given** the filter panel, **Then** it offers Konten, Art der Transaktion, Zeitraum, Kategorie, Tags, Kontobewegungen (alle / eingehend / ausgehend), Min/Max Betrag and Status (geprüft/ungeprüft), plus "Zurücksetzen" and "Ergebnisse anzeigen".
2. **When** the owner chooses "ausgehend", **Then** only bookings with negative amount remain.
3. The number of active filters shows on the button.

---

### User Story 3 - Dashboard like the reference (Priority: P2)

As the owner, the overview reads like the reference: chart header in one row, info icons on the headline, compact axis, cards with title links and menus, Top/Flop side by side, the same card order.

**Independent Test**: At 1440 px compare card order, header row and Kennzahlen grid against the table in the Overview; at 360 px all cards stack without scroll.

**Acceptance Scenarios**:

1. The net-worth chart header shows tabs and periods in one row (wrapping on phones); "Gesamtvermögen" and "Gewinn" carry an ⓘ with an explanation; the line has no area fill; the axis uses compact numbers (e.g. "5K €").
2. Card titles Aufteilung, Portfolios & Konten, Holdings, Einnahmen & Ausgaben and Budgets link to their page ("›").
3. Aufteilung shows the €/% switch below right of the donut.
4. Holdings shows Top and Flop side by side (stacked below 768 px).
5. Ungeprüfte Transaktionen is a one-line tile with count and "Alle anzeigen".
6. Kennzahlen shows TWROR, IZF, Inflation and Realrendite as a 2-column grid with the value right of the label.
7. Default order: left Aufteilung, Kennzahlen, Holdings; right Portfolios & Konten, Ungeprüfte, Einnahmen & Ausgaben, Budgets (the owner's custom layout still wins).

---

### User Story 4 - Cash-flow charts like the reference (Priority: P3)

As the owner, Einnahmen & Ausgaben and Budget › Analyse look like the reference: compact bars, clear month labels, boxed figures, Sankey card on Analyse, donut without gaps.

**Independent Test**: Budget › Analyse at 1440 px: bar chart, boxed figures, Sankey card and category donut as described.

**Acceptance Scenarios**:

1. Month labels show the month on the first line and the year on the second only at the first month of a year; a thin divider marks the year change.
2. Einnahmen, Ausgaben and Saldo sit in a bordered 3-column grid; Gespart and Sparquote in a separate bordered box.
3. Budget › Analyse shows a Sankey card with €/% switch and a link to the Sankey page.
4. The category donut has no gaps between segments and the centre label reads "Gesamtausgaben" (or "Gesamteinnahmen").

---

### User Story 5 - Add something from one large window (Priority: P3)

As the owner, "+ Hinzufügen" opens one large window: tab "Anbieter" with search and the providers the app supports, tab "Assets" for a manual asset; after choosing a provider I pick how to import.

**Independent Test**: Hinzufügen → search "Sparkasse" → choose → "Wie möchtest du importieren?" offers Automatisch (bank connection), Datei hochladen (CSV) and Manuell.

**Acceptance Scenarios**:

1. Tab "Anbieter" lists the supported providers (Scalable Capital, the owner's bank via Enable Banking, CSV import for Sparkasse and Scalable) and "Anbieter manuell hinzufügen"; search filters by name, IBAN or BIC.
2. After a provider: "Wie möchtest du importieren?" with the options the provider supports; unsupported ones are disabled with a short reason.
3. Tab "Assets" offers "Konto anlegen", "Transaktion erfassen" and "Wertpapier suchen" (005 search).

---

### Edge Cases

- Long names or purposes never push Betrag out: names truncate with full text on hover.
- Rows without counterparty show the purpose as name.
- The side panel on phones opens full screen.
- A booking in an account the filter hides closes the side panel.
- Card links open the matching page with the same account filter.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Transaktionen table MUST show Betrag without horizontal scroll from 1024 px; Konto and Verwendungszweck columns MUST be optional and off by default.
- **FR-002**: The column choice MUST include Datum, Kategorie, Tags, Eigenschaften, Konto, Verwendungszweck and Betrag and MUST be remembered per browser.
- **FR-003**: Clicking a row MUST open a booking side panel with the fields of US1 scenario 3; notes MUST be saved per booking.
- **FR-004**: The category window MUST offer search, Alle/Eigene, expandable main categories with icons, "Neue Kategorie erstellen" and the 006 options in one window with one "Speichern".
- **FR-005**: The filter MUST open as a side panel with the filters of US2 and "Ergebnisse anzeigen"; the button MUST show the number of active filters.
- **FR-006**: Kontobewegungen MUST filter by sign (eingehend > 0, ausgehend < 0).
- **FR-007**: The dashboard MUST follow US3 (header row, ⓘ, compact axis, card links, Top/Flop side by side, one-line Ungeprüfte tile, Kennzahlen grid, default order).
- **FR-008**: Cash-flow charts MUST follow US4.
- **FR-009**: "+ Hinzufügen" MUST open the large window of US5.
- **FR-010**: Everything MUST work from 360 px, dark and light, German, without "NaN".

### Key Entities

- **Booking note** (new): free text per booking, up to 1 000 characters.
- **Column preference** (existing, per browser): visible columns of the Transaktionen table.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At 1024, 1280 and 1440 px the amount of every booking is visible without horizontal scroll.
- **SC-002**: Changing category, scope and "merken" takes one window and at most 4 clicks.
- **SC-003**: All booking fields listed in US1 are reachable from the table in one click.
- **SC-004**: A side-by-side comparison of the 8 places in the Overview finds no difference in which elements exist and where they sit (colors and branding may differ).

## Assumptions

- Branding, colors and the font stay the app's own; only structure, order and wording follow the reference.
- "Aus den Statistiken entfernen" and "Transaktion aufteilen" are not part of this feature (no data model for them yet); the side panel leaves room for them.
- "Kontentransfer" uses the existing transaction type `transfer`.
- Card menus (⋮) offer what the app can do (e.g. hide card, €/%), not the reference's PLUS functions.
