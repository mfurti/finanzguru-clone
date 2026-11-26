# Quickstart: Logos for Banks, Brokers, Portfolios and Accounts (009)

Local only (web 3100, API 3101). Gates: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

| # | Story | Steps | Expected |
|---|---|---|---|
| A1 | US1 | Übersicht, Konten, account detail, account filter, booking side panel with a Sparkasse and a Klarna account | Sparkasse and Klarna logos everywhere; "Manuell" accounts keep initials; network log only localhost |
| A2 | US2 | Put `scalable-capital.png` and a `brands.json` entry (words "scalable capital") into `apps/api/data/brand-logos/`, restart API | Scalable depot and bookings of "Scalable Capital Bank GmbH" show the logo; `git status` clean |
| A3 | US2 | Add a 1 MB file and an SVG with `<script>` | Both skipped with a warning; app starts |
| A4 | US3 | Account detail → logo → "Kein Logo", then "Automatisch"; then upload a PNG | Initials, logo again, upload on all accounts of that institution |
| A5 | all | 360 px, dark and light | No horizontal scroll, no layout shift |
| A6 | SC-001 | Owner fills the folder for own institutions | All non-manual accounts show a logo |

## T011 result (2026-11-26, owner's data, local dev server)

- Local folder: one logo (Scalable Capital, official site icon, SVG 900 bytes, downloaded with the owner's OK) plus `brands.json`; `git status` stayed clean.
- Real (non-demo) accounts and portfolios: 3 of 3 show a logo (2 × Scalable Capital from the local folder, 1 × Sparkasse built in) → **SC-001 met**. The two demo institutions have invented names and keep initials.
