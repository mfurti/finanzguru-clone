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
