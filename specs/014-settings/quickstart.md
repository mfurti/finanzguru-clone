# Quickstart: 014

Local only (web 3100, API 3101). Gates: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

| # | Story | Steps | Expected |
|---|---|---|---|
| Q1 | US1 | Konten: rename, hide, archive, reorder | Applies to lists, filters, sums |
| Q2 | US1 | Refresh daily 06:00; consent ends in ≤ 14 days | Fetch runs at the time; notice shown |
| Q3 | US1 | Backup download → restore → restart | Identical data (counts, sums) |
| Q4 | US2 | Start page Budget; privacy mode; density; default period | Redirect; amounts masked; compact tables; period preselected |
| Q5 | US3 | Church tax BY; budget start 25; purchases not saved | Tax estimate +8 %; November = 25.10.–24.11.; Gespart without buys |
| Q6 | US4 | Change password; second browser session; auto logout 15 min | Other session ended; list shows sessions; idle logout |
| Q7 | all | Layout guard incl. settings pages | No sideways scroll at 375/768/1440 |

## Status (T015)

| # | Automated check | Owner check |
|---|---|---|
| Q1 | `accounts-manage.e2e-spec.ts`, `account-settings.spec.ts`, Playwright `us-st1-accounts` | pending |
| Q2 | `refresh-schedule` unit + e2e, `bank-consent-notice.spec.ts` | pending |
| Q3 | `backup.e2e-spec.ts`, `backup-restore.e2e-spec.ts` (round trip with restart), Playwright `us-st1-data` | pending |
| Q4 | `start-page.spec.ts`, `privacy-mode.spec.ts`, Playwright `us-st2-display`, `us-st2-privacy` | pending |
| Q5 | `capital-gains-tax.spec.ts`, `budget-month-start` unit + e2e, `finance-settings.e2e-spec.ts` | pending |
| Q6 | `sessions.e2e-spec.ts`, `password-change.e2e-spec.ts`, `security-card.spec.ts`, Playwright `us-st4-security` | pending |
| Q7 | Layout guard and hydration check include all settings pages (375/768/1440) | pending |

Notes:

- Church tax shows as the estimated tax on the Vorabpauschale (the only tax estimate in the app).
- Existing sessions from before 014 have no session row: the owner logs in once after the update.
- The colour mode follows the owner setting on every device; the header button updates it.
