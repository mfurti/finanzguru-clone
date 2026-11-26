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
