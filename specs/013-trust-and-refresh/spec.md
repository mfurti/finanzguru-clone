# Feature Specification: Trustworthy Figures, Refresh and Data Timestamp

**Feature Branch**: `20-trustworthy-figures-refresh-and-data-timestamp-013`

**Created**: 2026-11-27

**Status**: Implemented

**Input**: Owner review on 2026-11-27 (second round): "Der Balken, der sich mit der Maus bewegt, hat viel Delay", "Dashboard-Kacheln haben eine Hervorhebung beim Drübergehen, sonst nirgends – entfernen", "Button zum Konten aktualisieren links neben Anpassen", "Datum und Uhrzeit des aktuellen Stands", "Die Zahlen müssen stimmen, ich muss mich drauf verlassen können".

## Findings

| # | Place | Gap found |
|---|---|---|
| R1 | Charts with a hover line (net worth, investments, dividends, cash flow, analysis) | The hover line and tooltip follow the pointer with a visible delay |
| R2 | Übersicht › Dashboard | Cards get a hover highlight; no other page has one |
| R3 | Übersicht | No way to fetch the current state of all connected sources at once |
| R4 | Everywhere | The app does not say how current its data is |
| R5 | Figures | Demo accounts are part of "Alle Konten" and change the owner's sums (cause of the dividend gap in 012); open gaps A2/A4 (period gain), A5 (realized net), A18 (one month bar) from 010; no check that balances equal the source; no automatic check that the same figure is equal on every page |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Figures the owner can rely on (Priority: P1)

The owner sees only their own accounts in every sum, the balances equal the bank and broker, the same figure is equal on every page, and any remaining difference to the reference is explained in the app.

**Why this priority**: The owner explicitly needs to rely on the numbers.

**Independent Test**: Remove demo data; compare balances with the sources; run the consistency checks; repeat the reference audit.

**Acceptance Scenarios**:

1. **Given** demo data exists, **When** the owner removes it (one action, confirmed), **Then** all demo institutions, accounts, bookings, instruments only used by them, budgets, watchlists and contracts created by the demo are gone and every sum shows only the owner's data.
2. **Given** a synced account, **When** its balance in the app differs from the source balance of the same day, **Then** the account shows a warning with both values and the difference.
3. **Given** any period and account selection, **When** the owner compares Dashboard total, Aufteilung and Portfolios & Konten, Sankey and Einnahmen/Ausgaben, categories sum and Ausgaben gesamt, **Then** they are equal to the cent (checked by automatic tests).
4. **Given** the open gaps A2/A4, A5 and A18, **When** the owner compares with the reference using the same accounts, **Then** each figure is equal or the app shows an ⓘ note with the documented difference.

---

### User Story 2 - Refresh with one click and see how current the data is (Priority: P2)

On the Übersicht, a "Aktualisieren" button left of "Anpassen" fetches all connected sources (bank sync, broker sync, quotes). Next to it the app shows "Stand: <Datum>, <Uhrzeit>"; hovering shows the time per source; an old state is highlighted.

**Acceptance Scenarios**:

1. **Given** connected sources, **When** the owner clicks "Aktualisieren", **Then** the icon spins, each source is fetched, and a message shows success or the error per source; figures refresh afterwards.
2. **Given** sources were fetched, **When** the owner looks at the Übersicht header, **Then** "Stand: TT.MM.JJJJ, HH:MM" shows the oldest successful fetch of the connected sources; the tooltip lists each source with its time.
3. **Given** the state is older than 24 hours, **When** shown, **Then** it is highlighted as outdated.
4. **Given** no source is connected, **When** the Übersicht is shown, **Then** the button is disabled with a hint to Datenquellen and the state shows the newest booking date.

---

### User Story 3 - Charts that follow the pointer directly (Priority: P3)

**Acceptance Scenarios**:

1. **Given** any chart with a hover line, **When** the owner moves the pointer, **Then** line and tooltip jump to the nearest point without visible delay.
2. **Given** the dashboard, **When** the owner hovers a card, **Then** it does not change its look (same as all other pages).

### Edge Cases

- A source fails during refresh: others still run; the state keeps the last successful time of the failed source and marks it.
- Removing demo data when the owner moved a demo booking into an own account: only rows still belonging to demo accounts are removed.
- Source balance unknown (manual account, CSV import): no balance check, no warning.
- Reference rule not derivable (A2/A4): documented note instead of a forced number.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The owner MUST be able to remove all demo data in one confirmed action; afterwards no sum contains demo data.
- **FR-002**: Synced accounts MUST compare the app balance with the source balance and show a warning with both values when they differ.
- **FR-003**: Automatic tests MUST check that the same figure is equal across pages (net worth, allocation, accounts; Sankey and cash flow; categories and expenses).
- **FR-004**: The gaps A2/A4, A5, A18 MUST be fixed or explained in the app with an ⓘ note.
- **FR-005**: The Übersicht MUST offer "Aktualisieren" left of "Anpassen" that fetches all connected sources and reports the result per source.
- **FR-006**: The app MUST show the data state (date and time) on the Übersicht, with per-source times in a tooltip and a highlight when older than 24 hours.
- **FR-007**: Hover lines and tooltips in charts MUST follow the pointer without visible delay.
- **FR-008**: Dashboard cards MUST NOT have a hover highlight.

### Key Entities

- **Source state**: source (bank connection, broker connection, quotes), last successful fetch, last error.
- **Balance check**: account, app balance, source balance, date, difference.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After removing demo data, every sum equals the sum of the owner's own accounts (test and owner check).
- **SC-002**: Consistency tests cover at least the three figure groups of FR-003 and pass.
- **SC-003**: The owner's balances equal the sources on the day of the check, or a warning shows the difference.
- **SC-004**: Hover line reacts within one frame (no transition) in every chart with a hover line.
- **SC-005**: One click refreshes all connected sources; the state shows the new time.

## Assumptions

- Demo data was seeded by the demo script and is recognizable by its demo institutions/accounts.
- Source balances are available from the bank sync and the broker sync where they deliver one.
- Settings for refresh intervals and data management follow in feature 014.
- Local only; no deployment; owner amounts only in the git-ignored audit file.
