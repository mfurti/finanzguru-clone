# Quickstart: Chart Look (011)

Local only (web 3100, API 3101). Gates: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

| # | Story | Steps | Expected |
|---|---|---|---|
| Q1 | US1 | Budget › Sankey, month with bookings, dark and light | Three columns + Saldo; flows coloured source → target; slim rounded blocks; labels beside blocks, no overlap; S1–S4 resolved |
| Q2 | US1 | Hover a block and a flow; switch € / % | Connected parts stay, rest fades; tooltip name, amount, share; labels switch |
| Q3 | US1 | Click a category block, then again; Tab to the block list and press Enter | Bookings filtered, then unfiltered; keyboard does the same |
| Q4 | US1 | Budget › Analyse Sankey card | Same look, compact height, link to the Sankey page |
| Q5 | US2 | Dashboard, Budget › Analyse, Investments › Analyse, Investments › Dividenden | Donuts same size, ring, gaps, centre text; hover shows the item in the centre |
| Q6 | US3 | Layout guard and hydration check (`pnpm test:e2e -- layout-guard hydration`) | No sideways scroll at 375/768/1440; no hydration warning |

## Status after T005 (2026-11-26)

| # | Status |
|---|---|
| Q1 | Sankey page at 1440 px, dark and light: slim rounded blocks, flows in category colours, labels beside the blocks without overlap; the last column reserves room for its longest label; blocks under 10 px show their name in the tooltip and the block list only |
| Q2 | Hover keeps connected parts, rest fades; tooltip with amount and share of income |
| Q3 | Click on a block filters the bookings (and clears again); keyboard block list does the same (e2e W7) |
| Q4 | Analyse card shows the same drawing; switching dark/light without reload updates labels and outline |

## Status after T008 (2026-11-26)

| # | Status |
|---|---|
| Q6 | Layout guard (375/768/1440) and hydration check green. Sankey on phones scrolls inside its card (page does not scroll sideways); labels of the first two columns are cut with "…" to the gap between columns, full name in the tooltip and the block list; reduced motion turns the animation off |

## Status after T009 (2026-11-26)

| # | Status |
|---|---|
| Q5 | Dashboard, Investments › Analyse, Investments › Dividenden and Budget › Analyse draw the same donut (192 px box, ring 22 px, gaps and rounded ends, centre amount and short label); Dividenden now shows its total and the hovered item in the centre; checked dark and light |
| Q1–Q4, Q6 | see T005 and T008 above; owner's own look at the new Sankey still to come |
