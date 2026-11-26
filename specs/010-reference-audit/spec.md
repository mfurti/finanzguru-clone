# Feature Specification: Figures, Calculations and Layout Checked Against the Reference

**Feature Branch**: `12-figures-calculations-and-layout-checked-against-the-reference-audit-010`

**Created**: 2026-11-26

**Status**: Implemented

**Input**: User description: "Für 010 werden wir alle Features, Rechnungen, Daten etc. kontrollieren, vieles von meiner App weicht von Finanzfluss ab, dort genau nach prüfen. Des Weiteren das Layout etwas anpassen: selbe Größe der Dropdowns, Umrahmungen von dem markierten Teil (Einnahmen/Ausgaben/Saldo, Gespart/Sparquote) etc. Verschiedene Browsergrößen testen (Tablet, Handy, PC), Layout aller Tabellen prüfen und aus den Abweichungen Spec, Plan und Tasks für Issue 010 erstellen."

**Origin**: Audit on 2026-11-26 with the owner's real accounts in both apps (Scalable Capital depot and Referenzkonto, Sparkasse Bodensee Giro; demo accounts excluded via the account filter). Reference viewed read-only at 1440, 768 and 375 px; the app measured at 375, 768 and 1440 px on 15 pages.

## Audit findings

### A. Figures and calculations (same accounts, same day)

Real values are kept locally (`apps/api/data/audit-010-local.md`, git-ignored); the public spec lists the gaps only.

| # | Place | Gap found |
|---|---|---|
| A1 | Übersicht › Gesamtvermögen | Chart total differs from Aufteilung total in the app (about 18 €); small quote difference vs. reference |
| A2 | Übersicht › Gewinn (1 J) | App about 50 € lower; gain definition differs |
| A3 | Kennzahlen › Investiertes Kapital | Cost basis of the open position differs (average entry price about 3,5 % higher in the app) |
| A4 | Kennzahlen › Kursgewinn | Different definition: reference shows the unrealized gain of current holdings (positive), app a negative period change |
| A5 | Kennzahlen › Realisierte Gewinne | App about 45 % higher; lot matching of sells differs; app deducts no tax (brutto = netto) |
| A6 | Kennzahlen › Steuern & Gebühren | Reference shows trade taxes/fees, app 0 |
| A7 | Kennzahlen › Gesamtertrag | App about half of the reference; follows from A4–A6 |
| A8 | Kennzahlen › TWROR / IZF | Differ by 0,6–2,4 percentage points; follow from cash flows and valuation |
| A9 | Kennzahlen › Realrendite | Reference shows none; app computes one |
| A10 | Positionen › Einstiegswert / Kursgewinn | Same as A3 (gain about 3,9 percentage points lower in the app) |
| A11 | Investments › Wertverlauf | Single-day drop to about 40 % of the value on 2025-12-05 (gap between sell and re-buy) |
| A12 | Einnahmen & Ausgaben › Ausgaben (month) | Reference counts "Sparen und Anlegen › Wertpapieranlage" as expense (one booking more) |
| A13 | Gespart | Reference: sum of "Sparen und Anlegen"; app shows 0 |
| A14 | Saldo | Follows from A12 |
| A15 | Sparquote | Reference: PLUS (locked); app shows 0 %, formula to be documented |
| A16 | Kategorien (month) | Reference categorizes all bookings; app leaves 27 of 48 expenses "Nicht kategorisiert" |
| A17 | Ungeprüfte Transaktionen | Count differs by about 2 % |
| A18 | Monatsbalken | One month differs by 100 € |

Matching: monthly income, giro balance, ETF quantity, interest, inflation rate.

### B. Layout (app at 375 / 768 / 1440 px)

| # | Place | Finding | Reference |
|---|---|---|---|
| B1 | Transaktionen, Sankey page, account/category detail bookings | Table 715 px in 328 px (phone) and 705 px (tablet) → Betrag scrolls out | Phone: list grouped by date (logo, name, category below, amount right); tablet: Name, Datum (short "24.11.26"), Kategorie, Betrag fit |
| B2 | Investments › Positionen | Table 1 106 px wider than its box at every width (1 068 px at 1440) | Fits at desktop; scrolls on phone with fixed name column |
| B3 | Investments › Buchungen | 1 137 px in 657 px at 768 px | Fits on tablet |
| B4 | Investments › Steuern | 520 px in 296 px on phone | – |
| B5 | Dropdowns/selects | Heights 24, 28 and 32 px mixed on one page (Übersicht, Transaktionen, Steuern, Sankey); 12 px font | One size everywhere |
| B6 | Figure boxes (Einnahmen/Ausgaben/Saldo, Gespart/Sparquote) | Borders barely visible in dark mode; Gespart/Sparquote with label above value | Clearly bordered rounded boxes on a darker surface; Gespart/Sparquote as one row each with label left (ⓘ) and value right; on wide Analyse page all five boxes in one row |
| B7 | Phone header area of Transaktionen | Tiles full height, filter buttons as a row | Compact tiles; tools in a ⋮ menu |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Same figures as the reference (Priority: P1)

The owner compares the overview, Kennzahlen, positions and Einnahmen & Ausgaben with the reference for the same accounts and sees the same values (within quote differences of the day).

**Why this priority**: Wrong figures undermine trust in the whole app; the audit found differences of up to 180 € in Kennzahlen.

**Independent Test**: With a fixture of buys, partial sells (with fees and taxes), a savings transfer and a gap day, the API returns the values the reference definitions produce (documented in research); the owner check (quickstart) shows A1–A15 within ±1 € (quotes aside).

**Acceptance Scenarios**:

1. **Given** the owner's three real accounts, **When** the overview loads, **Then** chart total and Aufteilung total are the same number.
2. **Given** an open ETF position after partial sells, **When** Kennzahlen and Positionen load, **Then** Investiertes Kapital, Einstiegswert and Kursgewinn follow the reference's definitions (research R1) and match it within ±1 €.
3. **Given** sells with taxes and fees, **When** Kennzahlen load, **Then** Realisierte Gewinne (brutto/netto) and Steuern & Gebühren match the reference's rules.
4. **Given** a transfer to the own depot categorized "Sparen und Anlegen", **When** the month is shown, **Then** it counts as expense and as Gespart exactly like the reference, and Saldo follows.
5. **Given** a day between a sell and a re-buy, **When** the value chart shows that day, **Then** there is no artificial drop.

---

### User Story 2 - Fewer uncategorized bookings (Priority: P2)

Common merchants (Klarna, Amazon, Apple, PayPal, Lieferando, Netflix, Spotify, telecom providers, drugstores, supermarkets) are categorized automatically like in the reference.

**Why this priority**: 27 of 48 November expenses were uncategorized; categories drive budgets and analysis.

**Independent Test**: Fixture bookings of common merchants get the expected default categories; the owner's November 2026 has at most 5 uncategorized expenses.

**Acceptance Scenarios**:

1. **Given** a booking "AMAZON PAYMENTS EUROPE", **When** imported, **Then** category "Shopping und Unterhaltung › Sonstige" (reference category) unless the owner's own rule says otherwise.
2. **Given** owner rules (006), **Then** they keep priority over default rules.

---

### User Story 3 - Tables that fit on phone, tablet and desktop (Priority: P2)

All tables fit their box at 1440 px; on tablets the essential columns fit; on phones bookings become a date-grouped list like the reference, and wide tables scroll with a fixed first column.

**Why this priority**: On a phone the amount of a booking is currently out of view.

**Independent Test**: The layout guard measures every page at 375, 768 and 1440 px: no page-level horizontal scroll, booking amount visible, positions table fits at 1440 px, first column fixed where a table scrolls.

**Acceptance Scenarios**:

1. **Given** 375 px, **When** Transaktionen opens, **Then** bookings appear grouped by date with logo, name, category and amount visible without scrolling sideways.
2. **Given** 768 px, **Then** Name, Datum (short), Kategorie and Betrag fit without scrolling.
3. **Given** 1440 px, **Then** the positions and investment bookings tables fit their box.
4. **Given** a table that must scroll on a phone (positions, taxes), **Then** its first column stays visible.

---

### User Story 4 - One look for controls and figure boxes (Priority: P3)

Dropdowns and selects have one size everywhere; figure boxes are clearly framed like in the reference, with Gespart/Sparquote as label-left/value-right rows and all five boxes in one row on wide Analyse pages.

**Why this priority**: Visual consistency; small effort, visible on every page.

**Independent Test**: Every select/dropdown trigger on the 15 pages has the same height and font size; figure boxes have a visible border in dark and light mode (contrast measured).

**Acceptance Scenarios**:

1. **Given** any page, **When** measured, **Then** all select/dropdown triggers share one height and font size.
2. **Given** dark mode, **Then** figure box borders are visible (contrast ≥ 1.5:1 against the card).
3. **Given** Budget › Analyse at ≥ 1280 px, **Then** Einnahmen, Ausgaben, Saldo, Gespart, Sparquote sit in one row.

---

### Edge Cases

- Reference values depend on its data provider; differences caused only by the day's quote or by bookings the reference does not have are documented, not "fixed".
- Sparquote: the reference hides it (PLUS); the app keeps showing it with the documented formula.
- Real (owner) values are used only in the local owner check; tests use invented fixtures.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Net-worth chart total and Aufteilung total MUST be computed from the same valuation (same quotes, same day).
- **FR-002**: Investiertes Kapital, Einstiegswert and Kursgewinn MUST follow the reference definitions documented in research (cost basis of the open position, unrealized gain).
- **FR-003**: Realisierte Gewinne MUST use the reference's lot matching and show brutto and netto (after taxes); Steuern & Gebühren MUST include trade fees and taxes from imported trades.
- **FR-004**: Gesamtertrag, TWROR, IZF and Realrendite MUST be derived from the corrected values; Realrendite rules documented (empty when the reference shows none).
- **FR-005**: The daily value series MUST not drop on days between a sell and a re-buy or when a quote is missing (carry the last known value).
- **FR-006**: Bookings in "Sparen und Anlegen" MUST count as expense and as Gespart (reference rule); Saldo and Sparquote follow.
- **FR-007**: Default categorization MUST cover the common merchants listed in User Story 2; owner rules keep priority.
- **FR-008**: The unreviewed count and monthly bars MUST follow documented rules; remaining differences listed in the quickstart.
- **FR-009**: At 375 px booking lists MUST render as date-grouped rows (logo, name, category, signed amount); at 768 px the essential columns MUST fit; at 1440 px all tables MUST fit their box; scrolling tables MUST keep their first column visible.
- **FR-010**: All select/dropdown triggers MUST use one size (height, font, radius) app-wide.
- **FR-011**: Figure boxes MUST have a visible border in both themes; Gespart/Sparquote MUST be label-left/value-right rows; Budget › Analyse MUST show the five figures in one row from 1280 px.
- **FR-012**: A Playwright layout guard MUST check all pages at 375/768/1440 px (no page overflow, table fit rules, one control height).

### Key Entities

- **Calculation rule**: documented definition per figure (reference behaviour, app formula, test fixture).
- **Audit record**: per figure reference value, app value, status (matched, fixed, explained difference), kept in quickstart.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A1–A15 match the reference within ±1 € (quote differences of the day excepted) in the owner check.
- **SC-002**: At most 5 uncategorized expenses in the owner's November 2026 (was 27).
- **SC-003**: Zero page-level horizontal scroll and booking amount visible on all pages at 375, 768 and 1440 px.
- **SC-004**: Exactly one select/dropdown height across all 15 pages.

## Assumptions

- The reference is only viewed; nothing is changed in the owner's reference account.
- Where the reference's definition cannot be derived from its UI (e.g. lot matching), research documents the chosen rule and the remaining difference.
- Owner data stays local; numbers in the repo are limited to the audit table above (no names of private persons).
- Local dev server only; no deployment.
