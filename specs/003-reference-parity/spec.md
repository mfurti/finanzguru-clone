# Feature Specification: Reference Parity (Vermögenskompass ↔ Finanzfluss Copilot)

**Feature Branch**: `3-reference-parity`

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "Referenz-Parität Vermögenskompass ↔ Finanzfluss Copilot (Vergleich 2026-11-24): Navigation (Budget: Analyse | Sankey | Budgets, Prüfen nach Übersicht › Transaktionen, Hauptreiter mit Unterstrich, globale Suche), Übersicht (Portfolios & Konten mit Detailseiten, Transaktionen als volle Tabelle mit Prüf-Workflow, Dashboard mit freiem Zeitraum und Wertpapier-Avataren), Investments (Sortierung, Kopieren, Avatare, Asset-Legende, Filter-Panel, Zeiträume, Dividenden nach Regionen/Branchen und Kalender, Vorabpauschale pro Broker), Budget (Zeitraumwähler, Kategorien-Icons und -Details, Budgets-Seite mit Chart und Tabelle, einheitliche Farben), Optik (Schrift Outfit). Nicht im Umfang: Teilen, Reverse Breakdown, Werbung, Sankey-Editor, Bank-Live-Sync."

## Overview

A page-by-page comparison of Vermögenskompass (features 001 and 002) with the reference tool on 2026-11-24 found these differences. Everything else already matches in function and layout (sections, cards, charts, sidebar/dropdown navigation, colors and sizes of cards).

| Area | Reference | Vermögenskompass today |
|---|---|---|
| Budget navigation | Analyse, Sankey, Budgets | Analyse, Prüfen, Budgets; Sankey only inside Analyse |
| Reviewing bookings | Übersicht › Transaktionen, filter "Nur ungeprüfte", "Alle als geprüft markieren" | Separate page Budget › Prüfen |
| Main tabs | Active tab underlined | Active tab as a pill |
| Search | Magnifier opens a search | Magnifier without function |
| Portfolios & Konten | One card per group with "+", rows with institution avatar, masked IBAN + copy, sparkline, refresh + last sync, detail pages | One card, plain rows, no detail pages |
| Transaktionen (Übersicht) | Balance tile, unreviewed tile, table with selection, search, filter panel, columns, tags, categories, export, 25/50/100 rows, sorting, editable category chip, delete per row | Simple list with search and paging |
| Dashboard | Free date range and menu on the net-worth chart, unreviewed as a card, security avatars | Fixed periods, unreviewed as a banner, no avatars |
| Positionen | Sortable columns, copy WKN/ISIN, avatars, asset legend on the chart | No sorting, no copy, no avatars, asset select in the card |
| Buchungen | Filter panel, all columns sortable | Fixed filter bar, date/amount sortable |
| Analyse | Wertentwicklung by "Jahre" and "Zeiträume" | Only years |
| Dividenden | Split by securities, regions, sectors; calendar view | Only by securities; calendar as a list |
| Steuern | Vorabpauschale per broker | Per fund only |
| Budget period | "Aktueller Monat", month dropdown, date range shown | Arrows only |
| Kategorien | Icon per category, chevron opens category details | Same tag icon for all, inline expand |
| Budgets page | Chart budget vs. spending per month, table Budgethöhe/Ausgaben/Status/Differenz incl. Gesamtbudget | Form and progress list |
| Colors | One color per category everywhere | Donut and Sankey use different palettes |
| Typography | Font "Outfit" | Default UI font |

Deliberately kept different: amounts stay in German format with a space before "€"; the own brand (name, logo, header color) stays.

Not in scope: sharing, reverse breakdown (ETF look-through), advertising/premium banners, Sankey editor, live bank synchronisation. "Aktualisieren" is only offered for sources that can sync (Scalable Capital from 001 US3); CSV accounts show the date of their last import instead.

Open work from 001 stays there: Scalable sync (001 T054–T058) and deployment (001 T079–T083).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review and manage all bookings in one table (Priority: P1)

Under Übersicht › Transaktionen the owner sees the balance of the selected accounts, a tile with the number of unreviewed bookings ("Nur ungeprüfte anzeigen", "Alle als geprüft markieren") and a table of all bookings. The table can be searched, filtered in a panel (account, type, category, tag, period, amount range, reviewed state), sorted by any column, shown with 25/50/100 rows per page, and exported with the visible columns. Rows can be selected to set a category or delete them together; a category can be changed directly in its chip; single rows can be deleted. The separate page Budget › Prüfen is removed; old links lead to this table with "Nur ungeprüfte" active.

**Why this priority**: Reviewing and categorising bookings is the most frequent task and today it is split over two places.

**Independent Test**: With the demo data, filter to unreviewed bookings, select two rows, set a category, and check that the unreviewed count drops by two and the budget analysis reflects the category.

**Acceptance Scenarios**:

1. **Given** 5 unreviewed bookings, **When** the owner clicks "Nur ungeprüfte anzeigen", **Then** the table shows exactly those 5 and the tile shows "5".
2. **Given** two selected rows, **When** the owner sets the category "Lebensmittel", **Then** both rows show the new category and count as reviewed.
3. **Given** a row, **When** the owner changes its category chip, **Then** the change is saved without leaving the table.
4. **Given** "Alle als geprüft markieren", **When** confirmed, **Then** all bookings matching the current filter are marked reviewed and the count becomes 0 (bookings outside the filter are unchanged).
5. **Given** a deletion of one or more rows, **When** confirmed, **Then** the bookings are gone, balances and analyses are recalculated, and the action can be undone for 10 seconds.
6. **Given** hidden columns and an active filter, **When** exporting, **Then** the file contains exactly the visible columns and filtered rows.

---

### User Story 2 - Portfolios & Konten with details per account (Priority: P1)

Übersicht › Portfolios & Konten shows one card per group (Depots, Konten) with the group total and a "+" to add an account of that type. Each row shows an institution avatar (logo or initials), name, institution, the masked IBAN with a copy button, a 30-day sparkline of the balance, the last update (sync or import) with "Aktualisieren" where the source supports it, and the balance. A click opens the account's detail page with its balance history, key figures and its bookings (depot: positions and bookings).

**Why this priority**: Accounts are the entry point to all data and today have no detail view.

**Independent Test**: Open the demo Girokonto from the list and check that its detail page shows its balance chart and only its bookings.

**Acceptance Scenarios**:

1. **Given** an account with an IBAN, **When** the owner clicks copy, **Then** the full IBAN is in the clipboard and a short confirmation appears; the list itself shows only the first and last characters.
2. **Given** a CSV account, **Then** the row shows "Letzter Import: <date>" and no "Aktualisieren".
3. **Given** a depot, **When** opened, **Then** its detail page shows value history, positions and bookings of that depot only.
4. **Given** the "+" on the Konten card, **When** clicked, **Then** the account form opens with type "Konto" preselected.

---

### User Story 3 - Budget area like the reference (Priority: P2)

Budget has the sub pages Analyse, Sankey and Budgets. The period switcher offers arrows, "Aktueller Monat", a dropdown to pick a month (or quarter/year) and shows the date range. The Sankey page shows the Sankey with the bookings of the period below; clicking a block filters the bookings to that category. Categories show their own icon (chosen in the category settings) and the chevron opens a category detail view with its bookings and monthly history. Every category has one color used in the list, donut, Sankey and bars.

**Why this priority**: Completes the budget workflow; builds on US1's table.

**Independent Test**: Pick "September 2026" from the month dropdown, open Sankey, click "Wohnen", and check that the table lists only Wohnen bookings of September.

**Acceptance Scenarios**:

1. **Given** any period, **When** the owner clicks "Aktueller Monat", **Then** the current month is selected and the button is disabled while it is active.
2. **Given** the month dropdown, **When** a month is chosen, **Then** all cards on the page update to that month and the date range shows "01.09. – 30.09.".
3. **Given** the Sankey page, **When** a category block is clicked, **Then** the bookings table filters to that category; clicking again clears the filter.
4. **Given** a category with icon "Haus" and color "Blau", **Then** list, donut, Sankey and detail view show the same icon/color.

---

### User Story 4 - Budgets page with comparison chart and table (Priority: P2)

Budget › Budgets shows for the selected period a chart of budget versus spending per month (last 12 months, with "Gesamtbudget" as a toggle), and a table with Budgethöhe, Ausgaben, Status (progress) and Differenz per budget plus a Gesamtbudget row. Budgets are added via "Hinzufügen" (dialog) and changed or deleted via the row menu.

**Why this priority**: The current budgets page is a plain form; the comparison over time is the main value.

**Independent Test**: Create budgets of 500 € (Lebenshaltung) and 900 € (Wohnen) and check the table totals (1.400 € Gesamtbudget) and the status of each row for November.

**Acceptance Scenarios**:

1. **Given** two budgets, **Then** the Gesamtbudget row shows the sum of Budgethöhe, Ausgaben and Differenz.
2. **Given** spending above a budget, **Then** its status shows the overrun in red and Differenz is negative.
3. **Given** no budgets, **Then** an empty state with "Hinzufügen" is shown instead of the chart.

---

### User Story 5 - Investments details like the reference (Priority: P2)

Positionen: all columns sortable, WKN/ISIN with copy buttons, an avatar per security (initials in a stable color), the asset filter as a legend above the chart ("Alle / Aktien / ETF …"). Buchungen: a filter panel (type, depot, security, period, amount) behind a "Filtern" button with active-filter count, all columns sortable. Analyse: Wertentwicklung switchable between "Jahre" and "Zeiträume" (1M, 3M, YTD, 1J, 3J, 5J, Gesamt). Dividenden: split by securities, regions and sectors; the calendar as a month grid with a list fallback on phones. Steuern: Vorabpauschale grouped per broker with a sum per broker.

**Why this priority**: Many small gaps on existing pages; each is independent.

**Independent Test**: Sort positions by Kursgewinn descending, copy an ISIN, switch the Wertentwicklung to "Zeiträume", and check the dividend split by region.

**Acceptance Scenarios**:

1. **Given** the positions table, **When** a column header is clicked twice, **Then** the order toggles ascending/descending and an arrow shows the direction.
2. **Given** the asset legend, **When** "ETF" is clicked, **Then** chart and table show ETFs only.
3. **Given** "Zeiträume", **Then** each row shows IZF, inflation and real return for that period ending today.
4. **Given** dividends of ETFs with region weights (002), **Then** the region split distributes each dividend by those weights.

---

### User Story 6 - Dashboard refinements (Priority: P3)

The net-worth chart gets a date range picker (from/to) next to the period tabs and a menu (show/hide invested capital, show/hide benchmark). Unreviewed bookings appear as a card with count and the latest three bookings. Holdings and position rows show security avatars.

**Why this priority**: Visual and convenience improvements on a working page.

**Independent Test**: Pick 01.03.–30.06.2026 in the date picker and check that the chart and the gain cover exactly that range.

**Acceptance Scenarios**:

1. **Given** a custom range, **Then** the period tabs show no active tab and the range is shown as text.
2. **Given** the menu, **When** "Investiertes Kapital" is hidden, **Then** the second line disappears and the choice is remembered.

---

### User Story 7 - Global search (Priority: P3)

The magnifier in the header (and Ctrl/Cmd+K) opens a search over pages, securities, accounts and bookings (counterparty, purpose). Results are grouped; Enter opens the selected result.

**Why this priority**: Convenience; the button exists but does nothing today.

**Independent Test**: Search "MSCI" and open the security; search "Vermieter" and land in Transaktionen filtered to that text.

**Acceptance Scenarios**:

1. **Given** the search, **When** "Giro" is typed, **Then** the account "Demo Girokonto" is listed under Konten within 300 ms after typing stops.
2. **Given** no match, **Then** "Keine Treffer" is shown.

---

### User Story 8 - Typography and tabs like the reference (Priority: P3)

The whole app uses the font "Outfit" (self-hosted, no external requests). The main tabs show the active tab with an underline instead of a pill.

**Why this priority**: Largest remaining visual difference; small change.

**Independent Test**: Check computed font family on any page and that no font is loaded from third-party servers.

**Acceptance Scenarios**:

1. **Given** any page, **Then** text renders in Outfit with the fallback Arial/sans-serif while loading.
2. **Given** the main tabs, **Then** the active tab has a 2 px underline and no background.

### Edge Cases

- Deleting bookings that belong to an import: re-importing the same file must not bring them back silently (they are remembered as deleted).
- "Alle als geprüft markieren" with no filter affects all unreviewed bookings and asks for confirmation with the number.
- Accounts without IBAN show no copy button; depots show the depot number if known.
- Sparkline for accounts with fewer than 2 data points shows a flat line.
- Category detail for a category without bookings in the period shows an empty state with the monthly history.
- Budgets page with budgets created mid-year: earlier months show no budget (gap), not 0.
- Custom date range longer than the data: starts at the first data point.
- Search with fewer than 2 characters does not search.
- Avatars are generated from initials; no logos are fetched from the internet.

## Requirements *(mandatory)*

### Functional Requirements

**Navigation**

- **FR-001**: Budget MUST offer the sub pages Analyse, Sankey and Budgets; the former Prüfen page MUST redirect to Übersicht › Transaktionen with the unreviewed filter.
- **FR-002**: The main tabs MUST mark the active tab with an underline.
- **FR-003**: The header search MUST open a search over pages, securities, accounts and bookings (also via Ctrl/Cmd+K).

**Übersicht**

- **FR-004**: Transaktionen MUST show a balance tile, an unreviewed tile with "Nur ungeprüfte anzeigen" and "Alle als geprüft markieren" (with confirmation), and a table with search, filter panel, column choice, sorting on every column, 25/50/100 rows per page and CSV export of visible columns and filtered rows.
- **FR-005**: The table MUST support selecting rows (incl. all on the page) to set a category, set tags, mark reviewed or delete; deletions MUST be undoable for 10 seconds.
- **FR-006**: Bookings MUST support tags (free text, several per booking) that can be filtered and managed under "Tags".
- **FR-007**: A deleted imported booking MUST NOT be re-created by a later import of the same data.
- **FR-008**: Portfolios & Konten MUST show cards per group with total and "+", and rows with avatar, name, institution, masked IBAN with copy, 30-day sparkline, last sync/import and balance; "Aktualisieren" only for sources that support it.
- **FR-009**: Each account and depot MUST have a detail page with balance history, key figures and its bookings (depot: positions too).
- **FR-010**: The net-worth chart MUST offer a custom date range and a menu to show/hide invested capital and the benchmark (remembered).
- **FR-011**: The dashboard MUST show unreviewed bookings as a card with count and the latest three bookings.

**Investments**

- **FR-012**: The positions table MUST be sortable by every column and show copy buttons for WKN and ISIN and an avatar per security.
- **FR-013**: The asset-class filter MUST be shown as a legend above the performance chart and filter chart and table.
- **FR-014**: Buchungen MUST offer a filter panel (type, depot, security, period, amount range) with an active-filter count and sorting by every column.
- **FR-015**: The Wertentwicklung MUST switch between "Jahre" and "Zeiträume" (1M, 3M, YTD, 1J, 3J, 5J, Gesamt) with IZF, inflation and real return.
- **FR-016**: Dividends MUST be split by securities, regions and sectors (using the instrument weights from 002) and offer a month-grid calendar.
- **FR-017**: The Vorabpauschale MUST be grouped per broker with a subtotal.

**Budget**

- **FR-018**: The period switcher MUST offer "Aktueller Monat", a month/quarter/year dropdown and show the date range.
- **FR-019**: The Sankey page MUST show the bookings of the period below the chart; clicking a category block MUST filter them.
- **FR-020**: Categories MUST have a selectable icon and color (category settings), used consistently in list, donut, Sankey, bars and detail.
- **FR-021**: Each category MUST have a detail view with its bookings in the period and its 12-month history.
- **FR-022**: The Budgets page MUST show a 12-month chart of budget vs. spending (with Gesamtbudget toggle) and a table with Budgethöhe, Ausgaben, Status, Differenz and a Gesamtbudget row; budgets are created in a dialog and edited/deleted per row.

**General**

- **FR-023**: The app MUST use the font Outfit, served by the app itself.
- **FR-024**: All new views MUST work at 360 px without horizontal page scroll, in dark and light mode, with German texts.
- **FR-025**: No new feature may send data to third parties (no external logos, fonts or search services).

### Key Entities

- **Tag**: Name (unique), color; many-to-many with bookings.
- **Deleted booking marker**: Source and fingerprint/source reference of a deleted imported booking, so imports skip it.
- **Category appearance**: Icon key and color per category (extends the existing category).
- **Chart preferences**: Show invested capital, show benchmark (extends the chart settings from 002).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner can categorise 10 unreviewed bookings in under 1 minute using multi-select.
- **SC-002**: Every page of the comparison table above shows the listed reference elements (checked page by page against the reference screenshots).
- **SC-003**: Sorting, filtering and paging the transactions table with 10,000 bookings responds in under 1 second.
- **SC-004**: Search results appear in under 300 ms after typing stops for a dataset with 10,000 bookings.
- **SC-005**: Category colors and icons are identical in all four category views for 100 % of categories.
- **SC-006**: All new pages pass the 360 px / dark / light checks without horizontal scroll or "NaN".
- **SC-007**: No request to a third-party host is made when loading any page (fonts and avatars included).

## Assumptions

- The comparison covers the reference pages Dashboard, Portfolios & Konten, Transaktionen, Positionen, Buchungen, Analyse, Dividenden, Steuern, Watchlists, Budget Analyse, Sankey, Budgets and Versicherung as of 2026-11-24.
- Outfit is licensed under the SIL Open Font License and may be bundled.
- Institution and security avatars use initials and a color derived from the name; real logos are out of scope.
- Sparklines use the existing daily balance snapshots.
- "Aktualisieren" triggers the source sync of 001 (Scalable) once available; until then only CSV import dates are shown.
- The undo of deletions keeps the deleted bookings for 10 seconds in the browser session before they are removed for good.
- Features 001 and 002 are the base; their data model and APIs are extended, not replaced.
