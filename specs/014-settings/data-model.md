# Data Model: 014

| Table | Change | Rule |
|---|---|---|
| `account` | existing `sort_order` (no new column) | order in lists and filters |
| `account` | `archived_at` text, nullable | archived accounts hidden from lists; sums optional by setting |
| `session` (new) | `id` text PK, `created_at`, `last_seen_at`, `user_agent` (≤ 200 chars) | one row per login |
| `user_setting` (existing) | keys `settings.*`, JSON values | see OwnerSettings |

**OwnerSettings** (defaults): `startPage` dashboard \| transactions \| budget (dashboard); `defaultPeriod` 1W \| 1M \| YTD \| 1Y \| 3Y \| 5Y \| ALL (1Y); `colorMode` light \| dark \| system (system); `privacyMode` boolean (false); `density` compact \| normal (normal); `assessmentDefault` single \| joint (single); `churchTax` none \| BY \| BW \| other (none); `purchasesCountAsSaved` boolean (true); `budgetMonthStart` 1–28 (1); `rounding` cents \| euros (cents); `refreshSchedule` { mode off \| daily \| interval, time HH:MM, hours 1–24 } (off); `autoLogoutMinutes` 0 (off) \| 15 \| 30 \| 60 \| 240 (0); `archivedInSums` boolean (false).
