# Feature Specification: Merchant Logos for Bookings

**Feature Branch**: `8-merchant-logos`

**Created**: 2026-11-25

**Status**: Draft

**Input**: User description: "Händler-Logos für Buchungen (wie Finanzfluss Copilot). Logos neben Empfängern in Transaktionen, Seitenpanel und überall, wo Buchungen gelistet sind. Quelle A: Markenlogos aus der freien Sammlung Simple Icons (CC0), in die App eingebaut, kein Netzwerkzugriff, einfarbig in Markenfarbe. Quelle C: eigenes Logo pro Empfänger hochladen (lokal gespeichert, Bildgröße begrenzt). Zuordnung über Aliasliste, manuelle Wahl im Seitenpanel mit Suche, gilt für alle Buchungen des Empfängers. Fallback: Initialen-Avatar. Nicht im Umfang: Online-Logodienste, farbige Originallogos, Logos für Wertpapiere, Deployment."

**Origin**: Owner request after 007, 2026-11-25. The reference app shows a logo next to most bookings; it gets them from its data provider. The bank connection used here (PSD2) delivers no logos.

## Reference comparison

| Place | Reference | App today | Target |
|---|---|---|---|
| Transaktionen table, name cell | Merchant logo, else initials | Initials avatar only | Brand logo when known, own logo when uploaded, else initials |
| Booking side panel header | Large logo | Initials avatar | Same rule, plus "Logo ändern" |
| Other booking lists (account detail, category detail, Sankey page, rule suggestions) | Logo | Initials | Same rule |
| Choosing a logo | Not possible | – | Search the built-in brand list or upload an own image; applies to all bookings of that recipient |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See brand logos automatically (Priority: P1)

The owner opens Transaktionen and sees the logos of well-known merchants (e.g. Rewe, Lidl, PayPal, Netflix, Deutsche Bahn) next to the bookings, without doing anything. Bookings of unknown recipients keep the initials avatar.

**Why this priority**: It delivers the visible "like the reference" effect for the majority of everyday bookings with zero effort and no privacy cost.

**Independent Test**: With bookings whose recipients are "REWE Markt GmbH", "PayPal (Europe) S.a.r.l. et Cie, S.C.A." and "Bäckerei Müller", open Transaktionen: the first two show the Rewe and PayPal logos, the third shows initials. No request leaves the computer.

**Acceptance Scenarios**:

1. **Given** a booking with recipient "REWE Markt GmbH", **When** the table loads, **Then** the Rewe logo is shown in the brand color in place of the initials.
2. **Given** a booking with recipient "PayPal (Europe) S.a.r.l. et Cie, S.C.A.", **When** the table loads, **Then** the PayPal logo is shown.
3. **Given** a booking whose recipient matches no known brand, **When** the table loads, **Then** the initials avatar is shown as before.
4. **Given** any page with bookings, **When** it loads, **Then** no logo is requested from a third-party service (the network log shows only requests to the app itself).
5. **Given** dark or light mode, **When** a logo is shown, **Then** it stays recognizable (sufficient contrast against the tile background).

---

### User Story 2 - Choose or correct the logo for a recipient (Priority: P2)

In the booking side panel the owner clicks the logo, searches the brand list (e.g. "lidl") and picks one, or removes a wrong automatic match. The choice applies to all bookings of that recipient, now and in future syncs.

**Why this priority**: The automatic match cannot know every spelling; a one-click correction makes the result reliable, like category rules do for categories.

**Independent Test**: For recipient "LIDL DIENSTLEISTUNG GMBH" without automatic match, open the side panel, choose "Lidl" via search, close: all bookings of that recipient show the Lidl logo; after reload and after a new booking of the same recipient arrives, it still does.

**Acceptance Scenarios**:

1. **Given** the side panel of a booking, **When** the owner clicks "Logo ändern", **Then** a picker opens with a search field and a grid of brand logos with names.
2. **Given** the picker, **When** the owner types "lid", **Then** only matching brands are listed (name or alias contains the text), Lidl among them.
3. **Given** a brand chosen, **When** the picker closes, **Then** every booking of that recipient (same normalized recipient name) shows that logo in all lists.
4. **Given** an automatic match that is wrong, **When** the owner chooses "Kein Logo", **Then** the recipient shows initials and the automatic match is not applied again.
5. **Given** a recipient with a chosen logo, **When** the owner chooses "Automatisch", **Then** the manual choice is removed and the automatic match (if any) applies again.

---

### User Story 3 - Upload an own logo (Priority: P3)

For a recipient without a brand logo (e.g. the local bakery, or ING, Lieferando, Tchibo, Flixbus which the brand list lacks), the owner uploads an image file in the picker. It is stored with the owner's data and shown like a brand logo.

**Why this priority**: Closes the gaps of the brand list; less frequent than US1/US2.

**Independent Test**: In the picker for "Bäckerei Müller", upload a 64×64 PNG: all bookings of that recipient show it; an 8 MB file or a text file is refused with a German message; deleting the upload brings back the initials.

**Acceptance Scenarios**:

1. **Given** the picker, **When** the owner uploads a PNG, JPEG or WebP image up to 256 KB, **Then** it is saved and shown for all bookings of that recipient.
2. **Given** a file larger than 256 KB or of another type (including SVG), **When** uploaded, **Then** it is refused with "Bild zu groß (max. 256 KB)" or "Nur PNG, JPEG oder WebP".
3. **Given** an uploaded logo, **When** the owner removes it, **Then** the file is deleted and the automatic rule applies again.
4. **Given** an uploaded logo, **When** shown, **Then** it is displayed in the same round tile size as brand logos, cropped to fit, without distortion.

---

### Edge Cases

- Recipient empty (only purpose text, e.g. card payment "KARTENZAHLUNG · …"): the automatic match also checks the purpose text after the posting text; manual choice is keyed on the same text the 006 rule draft uses (counterparty, else IBAN, else purpose part).
- Two brands match one name (e.g. "Aldi" → Aldi Nord or Aldi Süd): the alias list decides one fixed brand per alias; the owner can correct it (US2).
- Short brand names that appear inside other words (e.g. "dm", "O2", "ING", "Otto"): aliases match whole words only, so "Admiral" never becomes dm and "Ottobrunn" never Otto.
- Transfers between own accounts and trades: keep the existing icons/initials (no merchant logo).
- Same recipient written differently over time (upper/lower case, extra spaces): the normalized recipient key (same as 006) treats them as one.
- Upload while offline or very large page lists: logos are part of the app or local data, so lists of 200 rows render without extra waiting compared to today.
- Brand list updates in a later app version: manual choices that point to a brand no longer present fall back to automatic/initials without errors.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST ship a built-in brand logo set (single-color glyphs with brand color) and MUST NOT fetch logos from any external service.
- **FR-002**: The app MUST map recipient names to brands automatically using a curated alias list covering at least the brands verified on 2026-11-25 (Rewe, Lidl, Aldi Nord, Aldi Süd, Edeka, dm, Kaufland, Netto, Penny, PayPal, Klarna, Netflix, Spotify, Deutsche Bahn, Vodafone, Telekom, O2, IKEA, Shell, Aral, Sparkasse, N26, Apple, Google, McDonald's, Burger King, Zalando, eBay, Otto, Rossmann, Uber).
- **FR-003**: Matching MUST be case-insensitive on the normalized recipient key and MUST match aliases as whole words only.
- **FR-004**: The logo rule MUST be the same everywhere a booking recipient is shown: own upload, else manual brand choice, else automatic match, else initials. "Kein Logo" MUST suppress the automatic match.
- **FR-005**: The booking side panel MUST offer "Logo ändern" with a searchable brand picker (search by name and alias), "Automatisch", "Kein Logo" and "Eigenes Logo hochladen".
- **FR-006**: A logo choice MUST apply to all current and future bookings of the same recipient key and MUST survive reloads and new syncs.
- **FR-007**: Uploads MUST accept only PNG, JPEG or WebP up to 256 KB, MUST be stored with the owner's local data (included in backups like the database) and MUST be removable.
- **FR-008**: Uploaded and brand logos MUST be shown in the same round tile as the initials avatar in sizes small (lists) and large (panel header), in dark and light mode, with the recipient name as accessible label.
- **FR-009**: Bookings of type transfer, buy, sell, dividend, split MUST keep their current icons; logos apply to income, expense, fee, interest, tax, deposit and withdrawal bookings only.
- **FR-010**: All texts MUST be German; no layout shift (007 guard) when logos load or the picker opens.
- **FR-011**: The licence note of the brand set (CC0) and the note that brand logos remain trademarks of their owners MUST appear in the app's settings/about area.

### Key Entities

- **Brand**: built-in entry with key, display name, glyph, brand color and aliases (search words). Ships with the app; not stored per owner.
- **Recipient logo choice**: per normalized recipient key: mode (brand, none, upload), chosen brand key or uploaded image reference, timestamps. Owner data, kept locally.
- **Uploaded logo image**: image file of an owner upload, max 256 KB, PNG/JPEG/WebP, linked to one recipient logo choice.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the owner's real bookings, at least 50 % of expense bookings in the last 3 months show a logo automatically (measured once after US1 on the local dev server).
- **SC-002**: Changing the logo of a recipient takes at most 3 interactions (open picker, search, choose) and is visible in all lists immediately.
- **SC-003**: Zero network requests to hosts other than the app while browsing bookings (checked in the browser's network log).
- **SC-004**: No wrong automatic match among the 30 most frequent recipients of the owner (checked once; wrong ones fixed in the alias list).
- **SC-005**: Lists with 200 bookings render without visible delay compared to before (no layout shift, no "NaN", usable from 360 px).

## Assumptions

- The brand set is Simple Icons (CC0), bundled with the app at build time; brands it lacks (ING, Lieferando, Tchibo, Flixbus as of 2026-11-25; Amazon was removed from the set at the brand's request, found in T005) are covered by own uploads.
- Single-color glyphs in brand color are acceptable instead of colored original logos.
- The recipient key and fallback order (counterparty, IBAN, purpose part) from feature 006 are reused, so logo choices and category rules address the same recipient.
- Securities, depots and accounts keep their current icons/initials (out of scope).
- Local dev server testing only; deployment follows a separate plan.
- Trademark use is private (self-hosted for the owner); no public redistribution of logos beyond the CC0 set.
