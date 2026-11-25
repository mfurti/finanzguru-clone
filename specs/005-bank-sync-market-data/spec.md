# Feature Specification: Bank Sync and Market Data

**Feature Branch**: `5-bank-sync-market-data`

**Created**: 2026-11-24

**Status**: Implemented (bank walkthrough T008/T016 pending the owner's Enable Banking app)

**Input**: User description: "Bank-Sync und Marktdaten (Vermögenskompass, nach Finanzfluss-Vorbild geprüft am 2026-11-24). A) Sparkasse live über Enable Banking (PSD2-Kontoinformationsdienst, Restricted Production für eigene Konten des Owners) … B) Anlageklassen-Chart wie Finanzfluss … Wertpapierseite zeigt GuV aufgeteilt in Realisiert + Kursgewinn. C) Watchlist „Asset suchen“ … Kurse und Kursverlauf über die bestehende Scalable-Verbindung … Nicht im Umfang: Deployment (eigener Plan), Trade Republic, Handel/Überweisungen, andere Banken als die des Owners."

## Overview

Three gaps remain after feature 004 compared with the reference app (checked on 2026-11-24):

| Area | Gap | Reference behavior |
|---|---|---|
| Bank | Checking accounts only update through CSV import | The reference app reads bank accounts live through a licensed account-information service; the owner logs in on the bank's own page |
| Investments chart | Asset-class chips filter the chart; per-class return ignores sold positions | Chips add extra lines; headline and table stay "Alle"; € view shows value per class, % view shows time-weighted return per class that stays flat after a sale |
| Security page | Only one gain figure | Gain is split into realized gain and price gain |
| Watchlist | Securities can only be added from existing holdings | "Asset suchen" dialog: search by name, ISIN or WKN, class filter chips, results grouped by class |

Deployment is **not** part of this feature. Everything is tested locally first; deployment gets its own plan.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sync my Sparkasse account live (Priority: P1)

As the owner, I connect my Sparkasse checking account once through a licensed account-information service. I log in and approve access on the service's and the bank's own pages. After that, balance and bookings refresh with "Aktualisieren" or once a day, without CSV exports.

**Why this priority**: The checking account is the main source of budget data. Manual CSV exports are the biggest remaining chore.

**Independent Test**: Connect the owner's account in the local app, run a sync, and compare balance and the last 30 days of bookings with online banking. A second sync adds nothing.

**Acceptance Scenarios**:

1. **Given** no bank connection, **When** the owner starts "Bank verbinden" in Datenquellen, **Then** the app sends them to the service's page, and after approval the app lists the approved accounts with institution, masked IBAN and balance.
2. **Given** an account that already has CSV-imported bookings, **When** the first sync runs, **Then** bookings that are already present are recognized and not added again, and the account balance matches the bank.
3. **Given** a connected account, **When** the owner presses "Aktualisieren" or the daily sync runs, **Then** new bookings appear with category rules applied and marked "ungeprüft".
4. **Given** consent ends in 14 days or less, **When** the owner opens the app, **Then** a notice shows the end date and offers "Zugang erneuern"; after the end date, syncs stop with a clear message and no data is lost.
5. **Given** a connected bank, **When** the owner presses "Trennen", **Then** the stored access is deleted, the source shows as disconnected, and all imported bookings and accounts stay.

---

### User Story 2 - Compare asset classes in the performance chart (Priority: P2)

As the owner, I tap asset-class chips (Alle, Aktien, ETF, …) above the investments chart to add a line per class. The headline value, gain and the positions table keep showing "Alle". In the € view each line shows the value of that class; in the % view each line shows the time-weighted return of that class, which stays at its last value after the class is sold.

**Why this priority**: The current filter hides the total and shows a misleading return for sold classes. The reference behavior is clearer.

**Independent Test**: With seeded data that sells all shares mid-period, toggle "Aktien": the € line drops to 0 after the sale, the % line stays flat at its last value, and the headline does not change.

**Acceptance Scenarios**:

1. **Given** the chart in € view, **When** the owner selects "Aktien" and "ETF", **Then** two extra lines appear next to "Alle", each with its own color and legend entry, and the headline and table do not change.
2. **Given** a class fully sold on a date, **When** the % view is shown, **Then** that class's line is flat from the sale date and its last value equals the class's return up to the sale.
3. **Given** a class without holdings in the selected period, **Then** its chip is disabled or hidden; the UI never shows "NaN".

---

### User Story 3 - See realized gain and price gain per security (Priority: P2)

As the owner, I open a security page and see its total gain split into "Realisiert" (from sales) and "Kursgewinn" (on the shares I still hold). Both add up to the total to the cent.

**Why this priority**: Without the split, partly sold positions show a confusing gain.

**Independent Test**: A seeded security bought twice and partly sold shows realized gain from the sale (FIFO) and price gain on the rest; the sum equals the total.

**Acceptance Scenarios**:

1. **Given** a fully sold security, **Then** "Kursgewinn" is 0,00 € and "Realisiert" equals the total gain.
2. **Given** a security never sold, **Then** "Realisiert" is 0,00 € and "Kursgewinn" equals the total gain.
3. **Given** a partly sold security, **Then** "Realisiert" + "Kursgewinn" = total gain exactly.

---

### User Story 4 - Find a security and watch it with live quotes (Priority: P3)

As the owner, I open "Asset suchen" in the watchlist, search by name, ISIN or WKN, narrow by class chips, and add a result to a watchlist. The watchlist shows the current price, daily change and a price chart, refreshed in the background through my existing broker connection, so I do not need to open the broker's app.

**Why this priority**: Useful, but the core tracker works without it. It depends on the broker connection from feature 004.

**Independent Test**: With the broker connected, search "Apple", filter "Aktien", add the first hit, and see price and chart on the watchlist within one refresh cycle.

**Acceptance Scenarios**:

1. **Given** the dialog is open, **When** the owner types at least 2 characters, **Then** results appear grouped by class with name, ISIN and class, at most 10 per class plus "Mehr anzeigen".
2. **Given** a class chip is selected, **Then** only results of that class are shown.
3. **Given** a result, **When** the owner adds it, **Then** it appears in the chosen watchlist; adding it twice is refused with a message.
4. **Given** watchlist entries, **When** the background refresh runs (during market hours at most every 15 minutes), **Then** price, daily change and time of the quote update; the owner can also refresh manually.
5. **Given** the broker is not connected, **Then** the dialog explains that search and quotes need the broker connection and links to Datenquellen; existing entries show the last known price with its date or "–".

---

### Edge Cases

- Bank returns a booking that changes later (pending → booked): only booked entries are imported; a pending entry never creates a duplicate.
- Bank or service is unreachable or rate-limited: the sync fails with a German message, keeps the previous data, and the next scheduled run retries.
- Consent revoked at the bank side: the next sync marks the source "Zugang abgelaufen" and offers renewal.
- The bank shows more accounts than the owner approved: only approved accounts are imported.
- A CSV booking and a live booking differ slightly in purpose text: matching uses date, amount and counterparty/reference, not free text only.
- Foreign-currency bookings on the bank account: rejected as a row error, as in CSV import.
- Security search returns a class the app does not know: shown under "Sonstige".
- A quote is older than one trading day: the watchlist shows its date instead of a misleading "today".
- Asset-class chart with only one class: the chip still adds a line equal to "Alle".

## Requirements *(mandatory)*

### Functional Requirements

**Bank sync (US1)**

- **FR-001**: The owner MUST be able to connect their own bank accounts through a licensed account-information service, with login and consent done on the service's and bank's own pages. The app MUST NOT see or store the bank password.
- **FR-002**: The connection MUST be read-only: account list, balances and booked transactions only. Payments or any other write action MUST be impossible.
- **FR-003**: Access grants MUST be stored encrypted and MUST NOT appear in any response, log or error message.
- **FR-004**: Synced bookings MUST be deduplicated against existing bookings of the same account, including CSV-imported ones and earlier syncs.
- **FR-005**: The bank source MUST support "Aktualisieren", an optional daily sync (off by default), last-sync time and status, like the broker source.
- **FR-006**: The app MUST show the consent end date and a renewal notice from 14 days before it ends.
- **FR-007**: "Trennen" MUST delete the stored access and keep all imported data.
- **FR-008**: Synced bookings MUST run through the existing categorization rules and start as "ungeprüft".

**Asset-class chart and gain split (US2, US3)**

- **FR-009**: Asset-class chips MUST add one line per selected class; "Alle" stays visible and the headline and positions table MUST always show "Alle".
- **FR-010**: In € view, each class line MUST show the daily market value of the holdings of that class (0 when none held).
- **FR-011**: In % view, each class line MUST show the time-weighted return of that class, computed from the class's own values and buys/sells, and MUST stay constant while the class has no holdings.
- **FR-012**: The security page MUST show total gain, realized gain (FIFO, after fees) and price gain on held shares; realized + price gain MUST equal the total to the cent.

**Watchlist search and quotes (US4)**

- **FR-013**: The watchlist MUST offer an "Asset suchen" dialog searching by name, ISIN or WKN with class chips (Alle plus the app's asset classes: Aktien, ETF, Fonds, Anleihen, Krypto, Rohstoffe, Sonstige) and results grouped by class.
- **FR-014**: Search, quotes and price history MUST come only from read-only functions of the existing broker connection, each on the explicit allowlist.
- **FR-015**: Quotes for watchlist and held securities MUST refresh in the background during market hours at most every 15 minutes, and on demand.
- **FR-016**: Each quote MUST show its time; prices are stored as decimal strings and amounts in cents.
- **FR-017**: Without a broker connection, search MUST be disabled with an explanation; nothing else breaks.

**General**

- **FR-018**: All new UI text MUST be German, work from 360 px, in dark and light mode, and show "–" or an empty state for missing data.
- **FR-019**: Every new external integration MUST be documented in research: which data leaves the server, to whom, and under which license or registration.

### Key Entities

- **Bank connection**: one consent at the account-information service: institution, approved accounts, consent end date, status, encrypted access grant.
- **Synced account**: an existing or new checking account linked to a bank connection by masked IBAN.
- **Asset-class daily value**: per day and class: market value and net buy/sell flow, used for the € and % lines.
- **Quote**: latest price, daily change and time for a security, from the broker connection.
- **Price history point**: date and closing price for a security, used for the watchlist chart.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After connecting, the owner's checking-account balance in the app matches online banking to the cent.
- **SC-002**: Two syncs in a row and a sync after a CSV import of the same period add 0 duplicate bookings.
- **SC-003**: Connecting the bank takes the owner under 5 minutes, without exporting any file.
- **SC-004**: For every security, realized gain + price gain equals the total gain to the cent.
- **SC-005**: Toggling class chips never changes the headline value or the positions table.
- **SC-006**: A search for a known name or ISIN shows the matching security in the first result group within 2 seconds.
- **SC-007**: Watchlist quotes during market hours are never older than 30 minutes while the app runs.

## Assumptions

- The account-information service is Enable Banking in its free restricted mode, which allows linking only the developer's own accounts. This fits the single-owner app. Hosting for other people is out of scope.
- The owner registers the application at the service themself and stores its key in the local configuration; the key is never committed.
- Consent lasts about 90 days (bank-dependent); renewal is done by the owner.
- The broker connection from feature 004 offers read-only search, quote and chart functions; if a function is missing, the related UI shows an empty state.
- Market hours are Mon–Fri 08:00–22:00 Europe/Berlin.
- Not in scope: deployment, Trade Republic, payments or trading, banks other than the owner's, quotes from third-party market-data providers.
