# Research: Trustworthy Figures, Refresh and Data Timestamp (013)

## R1 – Crosshair delay

- **Decision**: set the Unovis crosshair (and tooltip) `duration` to 0 in every chart with a hover line, and make sure no wrapper throttles pointer events.
- **Rationale**: Unovis animates the crosshair position with its component transition duration; on dense series this reads as lag. Verify in T001 by measuring the line position one frame after a pointer move.

## R2 – Dashboard hover

- **Decision**: remove the `card-hover` class from dashboard widgets (keep the utility only if used elsewhere; otherwise delete it).

## R3 – Demo removal

- **Decision**: flag demo institutions (`is_demo`), set by the demo seed; a one-time migration marks the seeded demo institutions by their fixed names ("Demo Broker", "Demo Bank"). Removal deletes in dependency order inside one transaction; instruments/prices/weights/expected dividends only when no non-demo account references them; demo budgets, watchlist "Beobachten", demo insurance contract and demo rules by their seeded ids/names.
- **Alternatives**: a fresh database (loses the owner's data); hiding demo accounts only (sums still contain them unless every query filters).

## R4 – Balance check

- **Decision**: bank and broker sync store the balance reported by the source with its date; compare with the app balance at that date (snapshot/balance logic already used for account values). Warning when the difference ≠ 0.

## R5 – Refresh all and state

- **Decision**: `POST /api/sources/refresh-all` calls the existing per-connection sync and the quote refresh sequentially, collects `{ source, ok, at, error }`; state from `last_sync_at`/`last_synced_at` and quote dates. "Stand" = oldest last success among connected sources (honest lower bound); tooltip per source; outdated after 24 h.

## R6 – Open reference gaps

- **Decision**: re-run the owner audit (010 script, D rows) after demo removal; A18 compared month by month; A2/A4/A5 documented in ⓘ texts when the reference rule cannot be derived.
