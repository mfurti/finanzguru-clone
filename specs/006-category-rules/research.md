# Research: Category Rules That Learn (006)

## R1 – Reference behavior

- **Finanzfluss** (help page "Kategorien", checked 2026-11-25): changing the category of a booking asks whether it applies to this booking only or to all bookings of this recipient; multi-select offers "Kategorie überschreiben". The categories themselves are pre-filled by the bank-data provider. No visible rule editor.
- **Finanzguru**: learns from corrections; the mechanism is not documented.
- **Finanzblick**: "Immer so kategorisieren" for future bookings of the same recipient.
- **Decision**: combine the Finanzfluss question (scope) with an explicit, visible rule ("merken") and a rule editor. Rationale: the owner sees why a booking got its category (honest UI) and can fix rules; no opaque model.

## R2 – Recipient identity

- **Decision**: a booking's recipient key is the normalized counterparty (`normalizeText`: NFKC, lower case, single spaces, trimmed). Without counterparty the scope "Alle Buchungen dieses Empfängers" is not offered; the rule is pre-filled from the purpose (first 40 characters after the posting text).
- **Pre-filled rule**: `counterparty contains <normalized counterparty>`; alternative IBAN (`counterparty_iban equals`) when the booking has one; editable.
- **Alternatives**: fuzzy matching (unpredictable); IBAN only (card payments have none).

## R3 – Which bookings a scope or rule changes

- **Decision**: "Alle Buchungen dieses Empfängers" and applying a new rule change bookings whose `category_source` is null or `rule` (never `manual`) and whose type is not `transfer`. Rule application on import already skips manual ones (001 R11). "Regeln anwenden" keeps its 001 meaning (unreviewed, uncategorized only).
- The changed bookings from "all bookings of this recipient" become `manual` (the owner decided), rule-applied ones become `rule`.

## R4 – Suggestions

- **Decision**: every manual single-booking categorization with a counterparty upserts `rule_suggestion (counterparty_key, category_id)` and increments `count`. A suggestion is shown when `count ≥ 2`, `status = open`, and no enabled rule already matches a booking with that counterparty. Accept creates the pre-filled rule (R2) and applies it; decline sets `status = declined` and it is never shown again. Choosing "merken" in the dialog marks a matching suggestion `accepted`.
- **Where shown**: in the response of the category change (toast with "Regel anlegen") and as a banner on Transaktionen listing open suggestions.

## R5 – Rule order

- **Decision**: `priority` stays unique ascending; reorder sends the full ordered id list and rewrites priorities in one transaction (two-pass to avoid unique conflicts). New rules go to the end.

## R6 – Preview

- **Decision**: `POST /api/rules/preview` evaluates a draft rule with the existing `matchesRule` over all bookings and returns `{ matches, wouldChange }` (`wouldChange` excludes manual and transfers). Runs in memory over ≤ 20 000 rows.
