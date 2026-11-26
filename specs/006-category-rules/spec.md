# Feature Specification: Category Rules That Learn

**Feature Branch**: `6-category-rules`

**Created**: 2026-11-25

**Status**: Draft

**Input**: User description: "Kategorien lernen (Vermögenskompass, verglichen mit Finanzfluss und Finanzguru am 2026-11-25). Problem: Seit 003 … kann man beim Kategorisieren keine Regel mehr speichern (001 T069 „Regel speichern“ ging verloren) … A) Beim Ändern der Kategorie … nur diese Buchung oder alle Buchungen dieses Empfängers; Option „Für ähnliche Buchungen merken“ … B) Vorschlag „Regel anlegen?“ … C) Kategorien & Regeln: Regeln manuell anlegen, bearbeiten, Reihenfolge ändern, aktivieren/deaktivieren, Vorschau … Nicht im Umfang: KI/ML-Kategorisierung, Händlernamen-Bereinigung, Konten bearbeiten/löschen, Deployment, Klarna-Anbindung."

## Overview

Live bank bookings (feature 005) arrive uncategorized. Rules sort them automatically, but since feature 003 the app has no way to create a rule: the old review page had "Regel speichern" (001 T069), and the Transaktionen workspace that replaced it (003 T026) did not take the option over. Kategorien & Regeln only lists, deletes and applies rules.

An audit of all tasks of 001–005 on 2026-11-25 found this as the only lost function.

Reference behavior (checked 2026-11-25):

| App | Behavior |
|---|---|
| Finanzfluss | Changing a category asks: only this booking, or all bookings of this recipient. Multi-select offers "Kategorie überschreiben". Categories are pre-filled by the bank-data provider. |
| Finanzguru | Learns from corrections (no official documentation of the mechanism). |
| Finanzblick | "Immer so kategorisieren" applies the category to future bookings of the same recipient. |

This feature brings back explicit rules, asks like Finanzfluss, and suggests rules from repeated corrections. Nothing is categorized by a hidden model; the owner always sees and controls the rules.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Remember a category while categorizing (Priority: P1)

As the owner, when I change the category of a booking (category chip in the table or bulk "Kategorie setzen"), I choose whether it applies only to this booking or to all bookings of this recipient, and whether the app should remember it for future bookings. Then rent, electricity or Klarna debits are sorted automatically from now on.

**Why this priority**: Restores the lost function and is the core of "the app remembers".

**Independent Test**: Categorize one rent booking as "Miete" with "alle Buchungen dieses Empfängers" and "merken": all past uncategorized rent bookings get "Miete" and the next synced rent booking arrives as "Miete".

**Acceptance Scenarios**:

1. **Given** a booking from "Stadtwerke Konstanz", **When** the owner sets "Strom" and chooses "Nur diese Buchung", **Then** only this booking changes and no rule is created.
2. **Given** the same booking, **When** the owner chooses "Alle Buchungen dieses Empfängers", **Then** all bookings with the same counterparty that are not manually categorized get "Strom", and the count of changed bookings is shown.
3. **Given** "Für ähnliche Buchungen merken" is checked, **Then** a rule is created, pre-filled with the counterparty (editable; IBAN or purpose as alternatives), and future imported bookings that match get the category.
4. **Given** several selected bookings with one counterparty, **When** the owner uses "Kategorie setzen" with "merken", **Then** the same rule is created once.
5. **Given** a booking whose category was set by hand earlier, **Then** no rule ever changes it.

---

### User Story 2 - Suggestions from repeated corrections (Priority: P2)

As the owner, when I put the same counterparty into the same category by hand a second time, the app suggests "Regel anlegen?" so I don't have to think of it.

**Why this priority**: Makes the app feel like it learns, while the owner stays in control.

**Independent Test**: Categorize two bookings of "Telekom" as "Handy" one after another, each with "Nur diese Buchung": after the second, a suggestion appears; accepting creates the rule, declining hides it for good.

**Acceptance Scenarios**:

1. **Given** two manual categorizations of the same counterparty to the same category, **Then** a suggestion with counterparty, category and number of affected uncategorized bookings appears.
2. **When** the owner accepts, **Then** the rule is created and applied like in US1.
3. **When** the owner declines, **Then** the same counterparty–category pair is not suggested again.
4. **Given** a rule already covers the counterparty, **Then** no suggestion appears.

---

### User Story 3 - Manage rules (Priority: P2)

As the owner, under Kategorien & Regeln I create, edit, reorder, switch on/off and delete rules, and I see before saving how many bookings a rule would change.

**Why this priority**: Rules need care once there are many; today they can only be deleted.

**Independent Test**: Create a rule "Verwendungszweck enthält MIETE → Miete" with preview "12 Buchungen", save, apply; switch it off and see it no longer applies to new bookings.

**Acceptance Scenarios**:

1. **Given** the rules page, **When** the owner creates a rule (field: Gegenpartei, IBAN or Verwendungszweck; operator: enthält, ist gleich, beginnt mit, regulärer Ausdruck; optional only income or only expenses; category), **Then** a preview shows how many existing bookings it would categorize, and saving adds it at the end of the order.
2. **When** the owner moves a rule up or down, **Then** the order decides which rule wins when several match.
3. **When** a rule is switched off, **Then** it no longer applies to new bookings; existing categorized bookings stay.
4. **When** the owner edits a rule, **Then** the change applies to future bookings; "Regeln anwenden" applies it to existing uncategorized bookings.
5. An invalid regular expression is refused with a German message.

---

### Edge Cases

- Counterparty empty (e.g. card payments with only purpose text): "Alle Buchungen dieses Empfängers" is unavailable; the rule is pre-filled with the purpose text instead.
- Counterparty differs slightly between bookings ("Stadtwerke Konstanz GmbH" vs. "STADTWERKE KONSTANZ"): matching ignores upper/lower case and extra spaces; "enthält" covers suffixes.
- Two rules match one booking: the higher one in the order wins.
- A rule would change bookings that were categorized by another rule: existing rule-set categories are only changed by "Regeln anwenden" or the "all bookings" option, never silently on import.
- Transfers between own accounts stay transfers; rules don't override them.
- Bulk selection with different counterparties and "merken": no rule is created; the dialog says why.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Changing a booking's category MUST offer "Nur diese Buchung" and "Alle Buchungen dieses Empfängers" (when a counterparty exists).
- **FR-002**: "Alle Buchungen dieses Empfängers" MUST change all bookings with the same normalized counterparty except manually categorized ones and transfers, and report the number changed.
- **FR-003**: The category change MUST offer "Für ähnliche Buchungen merken", which creates a rule pre-filled with the counterparty (else the purpose), editable in field, operator and pattern before saving.
- **FR-004**: A new rule MUST apply to future imported bookings and to existing bookings without a category.
- **FR-005**: Bulk "Kategorie setzen" MUST offer the same "merken" option when all selected bookings share one counterparty.
- **FR-006**: After the second manual categorization of the same counterparty to the same category, the app MUST suggest a rule; declined suggestions MUST NOT reappear; no suggestion when a rule already matches.
- **FR-007**: The rules page MUST allow create, edit, delete, reorder, enable/disable, and show a preview count before saving.
- **FR-008**: Manually set categories MUST never be changed by rules or by "Regeln anwenden".
- **FR-009**: All new UI text MUST be German, work from 360 px, in dark and light mode.

### Key Entities

- **Categorization rule** (exists): field, operator, pattern, optional amount sign, category, order, enabled.
- **Rule suggestion** (new): counterparty, category, state (open, accepted, declined), number of manual categorizations seen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Saving a rule while categorizing takes at most 2 extra clicks compared with setting the category only.
- **SC-002**: After rules for the 5 most frequent counterparties exist, at least 80 % of new monthly bookings of these counterparties arrive categorized.
- **SC-003**: No manually set category changes through any rule action (0 such changes in tests).
- **SC-004**: A suggestion appears at the latest after the second identical manual categorization.

## Assumptions

- Rules stay explicit and visible; there is no hidden learning model (Constitution: honest UI, owner control).
- Counterparty comparison ignores case and repeated spaces, as the existing rule matching does.
- The suggestion threshold is 2 identical manual categorizations; it is not configurable in this feature.
- Out of scope: ML categorization, merchant-name cleaning and logos (Finanzfluss gets these from its provider), editing or deleting accounts, deployment, Klarna.
