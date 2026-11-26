# Feature Specification: Logos for Banks, Brokers, Portfolios and Accounts

**Feature Branch**: `9-account-logos`

**Created**: 2026-11-26

**Status**: Draft

**Input**: User description: "Bei Finanzfluss haben die Portfolios und Konten auch Logos – umsetzen. Fehlende Bank-Logos (Scalable Capital, ING, DKB, comdirect, Consorsbank, Volksbank, Postbank, flatex, Trading 212, Bitpanda) über einen lokalen, nicht versionierten Logo-Ordner einbinden; die App läuft nur lokal, das Repo ist nur wegen der GitHub-Freiminuten öffentlich."

**Origin**: Owner request after 008, 2026-11-26. The reference app shows the bank or broker logo next to every portfolio and account. The built-in sets of 008 cover some institutions (Sparkasse, Klarna, PayPal, Trade Republic, N26, Commerzbank, Deutsche Bank, Santander, Revolut, Wise, bunq, Coinbase) but not the owner's broker Scalable Capital nor ING, DKB, comdirect, Consorsbank, Volksbank, Postbank, flatex, Trading 212, Bitpanda. Official logos of those have no free licence, so they must never be committed to the (public) repository.

## Reference comparison

| Place | Reference | App today | Target |
|---|---|---|---|
| Übersicht › Portfolios & Konten card | Bank/broker logo per row | Initials | Institution logo, else initials |
| Konten page (groups, rows) and account detail header | Logo | Initials | Same rule |
| Account filter ("Alle Konten") | Logo per account | Text only | Small logo next to each account |
| Booking side panel › Konto | Bank shown with logo | Name only | Small logo next to account and bank |
| Datenquellen (bank connection, Scalable) | Provider logo | Icon | Institution logo where known |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See bank and broker logos automatically (Priority: P1)

The owner opens the overview and the Konten page and sees the logo of each bank or broker next to its portfolios and accounts, without doing anything, as far as a logo is available.

**Why this priority**: Most visible part of the request; works for the built-in institutions immediately.

**Independent Test**: With institutions "Sparkasse Bodensee", "Klarna" and "Musterbank", the first two show their logos on the overview card, the Konten page, the account detail and in the account filter; the third shows initials. No request leaves the computer.

**Acceptance Scenarios**:

1. **Given** an institution "Sparkasse Bodensee", **When** the overview loads, **Then** its accounts show the Sparkasse logo.
2. **Given** an institution without known logo, **When** shown, **Then** the initials appear as before.
3. **Given** any page with accounts, **When** it loads, **Then** no logo is requested from a third-party service.
4. **Given** 360 px width, dark or light mode, **When** logos are shown, **Then** no horizontal scroll, no layout shift, logos recognizable.

---

### User Story 2 - Add missing bank logos through a local folder (Priority: P2)

The owner (or a helper session with the owner's OK per download) puts official logo files of missing institutions into a local logo folder that is not versioned. The app picks them up and shows them like built-in logos, for institutions and also as merchant logos in bookings (e.g. "Scalable Capital Bank GmbH" as recipient).

**Why this priority**: Closes the gaps of the free sets for the owner's own banks without committing unlicensed files.

**Independent Test**: Put `scalable-capital.png` and an alias entry for "scalable capital" into the local folder, restart the API: the Scalable depot shows that logo; bookings with recipient "Scalable Capital Bank GmbH" too; `git status` shows no new files.

**Acceptance Scenarios**:

1. **Given** a PNG, JPEG, WebP or SVG file in the local folder and a mapping entry with words (e.g. "scalable capital"), **When** the API starts, **Then** institutions and booking recipients matching those words show this logo.
2. **Given** the local folder is missing or empty, **When** the API starts, **Then** everything works as before (built-in sets only).
3. **Given** an invalid file (too large, wrong type, SVG with scripts), **When** the API starts, **Then** it is skipped with a warning naming the file, and the app starts.
4. **Given** the repository, **When** files are added to the local folder, **Then** `git status` shows nothing (folder is git-ignored).
5. **Given** local logos exist for a brand also in the built-in sets, **When** matched, **Then** the local logo wins (owner's choice beats built-in).

---

### User Story 3 - Choose or correct the logo of an institution (Priority: P3)

On the account detail (or in Konten), the owner clicks the logo and picks another brand (built-in or local), "Kein Logo" or uploads an own image; it applies to all accounts of that institution.

**Why this priority**: Corrections are rare (few institutions); reuses the 008 picker.

**Independent Test**: Choose "Kein Logo" for "Klarna", reload: all Klarna accounts show initials; "Automatisch" brings the logo back.

**Acceptance Scenarios**:

1. **Given** an account, **When** the owner clicks its logo and chooses a brand, **Then** all accounts of that institution show it, also after reload.
2. **Given** "Kein Logo", **Then** initials; **Given** "Automatisch", **Then** automatic match again.
3. **Given** an own upload (PNG, JPEG, WebP, max. 256 KB), **Then** it is shown for all accounts of that institution.

---

### Edge Cases

- Institution names with location ("Sparkasse Bodensee", "Volksbank Kraichgau eG"): whole-word match on the brand words.
- Manual accounts with institution "Manuell": no logo, keep the existing manual icon/initials.
- Same brand as institution and as booking recipient (Klarna, PayPal): same logo in both places.
- Local folder file renamed or deleted after a choice was saved: fall back to automatic/initials without errors.
- Very wide logos (word marks): fit inside the round tile without distortion.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every place that lists portfolios or accounts (overview card, Konten page, account detail, account filter, booking side panel account line, Datenquellen cards) MUST show the institution logo, else initials.
- **FR-002**: Institution logos MUST follow the 008 order: own upload › chosen brand › "Kein Logo" › automatic match › initials; automatic matching MUST use the same whole-word alias matching and catalogue as merchant logos.
- **FR-003**: The app MUST support a local logo folder outside version control (default inside the git-ignored data directory, configurable) with logo files and a mapping file (brand name, words to match, file). It MUST be read at API start and MUST NOT be required.
- **FR-004**: Local logos MUST take precedence over built-in sets for the same words and MUST also be usable as merchant logos in bookings and in the logo picker search.
- **FR-005**: Local files MUST be validated like uploads (PNG, JPEG, WebP up to 256 KB) or as SVG with the 008 safety rules (no scripts, no handlers, no external references, max. 256 KB); invalid ones are skipped with a warning.
- **FR-006**: The owner MUST be able to choose, reset or upload the logo per institution, applying to all its accounts.
- **FR-007**: No logo MUST be loaded from a third-party host; the repository MUST NOT contain the local logo files (git-ignored folder, leak guard).
- **FR-008**: German texts, usable from 360 px, dark/light, no layout shift (007 guard).

### Key Entities

- **Institution logo choice**: per institution: mode (brand, none, upload), brand key or file. Stored with the institution (existing unused `logo_key` field or equivalent).
- **Local logo set**: logo files plus a mapping file in the local folder; each entry: key, display name, match words, file name. Not versioned.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After adding local logos for the owner's institutions, 100 % of the owner's non-manual accounts and portfolios show a logo.
- **SC-002**: Zero requests to third-party hosts while browsing accounts (network log).
- **SC-003**: `git status` stays clean after filling the local folder; no logo file appears in any commit.
- **SC-004**: Changing an institution's logo takes at most 3 interactions and is visible on all its accounts immediately.

## Assumptions

- The app is private and local/self-hosted; the repository is public only for free CI minutes (owner, 2026-11-26). Logos without free licence are fine locally but never in commits.
- The owner or a helper session (with the owner's OK per download) collects official logos from the institutions' press or brand pages; this collection is a manual step, not part of the app.
- The 008 catalogue, alias matching, picker and upload limits are reused.
- Deployment: the local logo folder lives in the data directory and travels with it; a separate deployment plan handles copying.
