# Quickstart: Merchant Logos (008)

Local only (web 3100, API 3101). Gates: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

| # | Story | Steps | Expected |
|---|---|---|---|
| L1 | US1 | Transaktionen with recipients "REWE Markt GmbH", "PayPal (Europe) S.a.r.l. et Cie, S.C.A.", "Bäckerei Müller" | Rewe and PayPal logos, initials for the bakery; network log only shows localhost |
| L2 | US1 | Recipients "Admiral Spielhalle", "Ottobrunn Apotheke" | Initials, no dm/Otto logo |
| L3 | US2 | Side panel of "LIDL DIENSTLEISTUNG" → Logo ändern → search "lid" → Lidl | All bookings of that recipient show Lidl, also after reload |
| L4 | US2 | Same recipient → "Kein Logo", then "Automatisch" | Initials, then automatic match again |
| L5 | US3 | Upload a 64×64 PNG for "Bäckerei Müller"; try an 8 MB JPEG and an SVG | PNG shown everywhere; the others refused with German message |
| L6 | all | 360 px, dark and light; 200-row page | Logos visible, no layout shift, no "NaN" |
| L7 | SC-001/004 | Owner's real data: share of expense bookings (last 3 months) with logo; top 30 recipients | ≥ 50 % with logo; no wrong match |

## T016 result (2026-11-26, owner's real bookings, local dev server)

- Expense bookings of the last 3 months: 234. With logo: 101 (43.2 %); of these 91 automatic (38.9 %) and 10 chosen by the owner in the picker.
- **SC-001 (≥ 50 % automatic) not met.** Main gap: Amazon (17 bookings, 7.3 %, three different recipient spellings) is not part of Simple Icons; the rest are local shops, canteens, pharmacies and private persons without a brand logo.
- **SC-004 met:** no wrong automatic match among the 30 most frequent recipients.
- Aliases added after the check (generic brand words only): Deutsche Post, DHL, Commerzbank, Zara, MediaMarkt, Saturn, easyJet.
- Way to close the gap without online services: own upload per recipient (US3). A follow-up could let one upload cover several recipients of the same brand (e.g. all Amazon spellings).

## T021 result (2026-11-26, after the colour set)

- Expense bookings of the last 3 months: 234. With logo: 118 (50.4 %); automatic 108 (46.2 %, all of them coloured logos), chosen by the owner 10.
- **SC-001: 50 % reached including the owner's choices; automatic alone 46.2 %** (was 38.9 %). Amazon (17 bookings) is now covered. The rest without logo are local shops, canteens, pharmacies and private persons.
- **SC-004 met again:** no wrong automatic match among the 30 most frequent recipients.
