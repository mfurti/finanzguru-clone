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
