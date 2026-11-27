# Feature Specification: Settings

**Feature Branch**: created with the issue (`gh issue develop`)

**Created**: 2026-11-27

**Status**: Draft

**Input**: Owner review on 2026-11-27: "Wir müssen die Einstellungen noch etwas ausarbeiten" – all proposed settings accepted ("Alle deine Vorschläge sind gut").

**Depends on**: 013 (demo data removal, source state).

## Today

Settings has three pages: Datenquellen, Kategorien & Regeln, Inflation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Accounts and data (Priority: P1)

The owner manages accounts (rename, hide, sort, archive), removes demo data, sets automatic refresh (off, daily at a time, every n hours), is warned before a bank consent expires, and can download a full backup (database and logos), restore it, and export all bookings as CSV.

**Acceptance Scenarios**:

1. **Given** Einstellungen › Konten, **When** the owner renames, hides, reorders or archives an account, **Then** the change applies everywhere (filters, lists, sums: hidden and archived accounts are left out of sums only when chosen).
2. **Given** automatic refresh set to daily at 06:00, **When** the time passes while the app runs, **Then** all connected sources are fetched and the data state updates.
3. **Given** a bank consent ends in ≤ 14 days, **When** the owner opens the app, **Then** a notice with the end date and a renew link is shown.
4. **Given** Einstellungen › Daten, **When** the owner downloads a backup and later restores it (confirmed), **Then** the app has exactly the backed-up state.

---

### User Story 2 - Display (Priority: P2)

Start page (Dashboard, Transaktionen, Budget), default chart period, colour mode (hell, dunkel, System), privacy mode that hides amounts, table density (kompakt, normal).

**Acceptance Scenarios**:

1. **Given** start page "Budget", **When** the owner opens the app, **Then** Budget › Analyse is shown.
2. **Given** privacy mode on, **When** any page shows an amount, **Then** it is masked ("•••• €") until switched off (also via a header button).
3. **Given** default period "YTD", **When** a chart with a period switch first loads, **Then** YTD is selected.

---

### User Story 3 - Finances and taxes (Priority: P2)

Assessment default (einzeln, zusammen), church tax (ja/nein, Bundesland), what counts as saved (e.g. securities purchases ja/nein), budget month start day (1–28), base currency EUR and display rounding.

**Acceptance Scenarios**:

1. **Given** church tax in Bayern, **When** the tax estimate is computed, **Then** it includes 8 % church tax on the capital gains tax.
2. **Given** budget month start on the 25th, **When** Budget shows "November", **Then** it covers 25.10.–24.11.
3. **Given** "Wertpapierkäufe zählen als gespart" off, **When** Gespart/Sparquote are computed, **Then** depot buys are left out.

---

### User Story 4 - Security and about (Priority: P3)

Change password, automatic logout after n minutes of inactivity, list of active sessions with "Überall abmelden"; about page with version, database size and last successful fetch per source.

**Acceptance Scenarios**:

1. **Given** a wrong current password, **When** the owner changes the password, **Then** it is refused; with the right one, other sessions are logged out.
2. **Given** auto logout 30 minutes, **When** the app is idle for 30 minutes, **Then** the session ends.

### Edge Cases

- Restoring a backup from an older app version: migrated on restore; newer than the app: refused.
- Budget month start > days of a month: clamped to the last day.
- Privacy mode in exports: exports stay complete (owner's own download).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Settings MUST offer the groups Konten & Daten, Anzeige, Finanzen & Steuern, Sicherheit, Über die App.
- **FR-002**: Every setting MUST apply immediately and persist on the server (not only in the browser), except per-device display conveniences.
- **FR-003**: Backup/restore and demo removal MUST ask for confirmation and say what is replaced or removed.
- **FR-004**: Tax and budget settings MUST change the computed figures accordingly (with tests).
- **FR-005**: Security settings MUST never show or store passwords in plain text.

### Key Entities

- **Owner settings**: start page, default period, colour mode, privacy mode, density, assessment default, church tax, saved rule, budget month start, rounding, refresh schedule, auto logout.
- **Account settings**: name, hidden, archived, position.
- **Session**: id, created, last seen, device hint.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every listed setting exists, persists across restart and changes the app as described (tests per setting).
- **SC-002**: A backup restores to an identical state (row counts and sums equal).
- **SC-003**: No page scrolls sideways at 375/768/1440 px; dark and light.

## Assumptions

- Single owner; no multi-user.
- Local only; no deployment.
