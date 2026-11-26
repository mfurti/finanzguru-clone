# Tasks: Chart Look – Sankey Redrawn, Donuts Made Uniform

**Input**: Design documents from `specs/011-chart-look/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md

**Tests**: included (tests per layer, Constitution IV). One commit per task; gates per commit: lint, format check, typecheck, API and web unit tests.

## Phase 1: Setup

- [X] T001 Add `echarts` 6.1.0 and `vue-echarts` 8.3.2 (exact pins) to `apps/web/package.json`, install, and register a tree-shaken setup (`echarts/core` + `SankeyChart`, `TooltipComponent`, `SVGRenderer`) in `apps/web/app/utils/echarts.ts`; verify `pnpm --filter web build` and that the chunk is only loaded on pages with a Sankey.

## Phase 2: Foundational

- [X] T002 Pure option builder `buildSankeyOption(graph, { incomeCents, unit, colors, theme, selected, reducedMotion })` in `apps/web/app/utils/sankey-option.ts`: nodes in `sankeyOrder()` order with `depth` (income 0, main 1, balance 1, sub 2), `layoutIterations: 0`, slim rounded nodes (`nodeWidth` ≈ 12, `borderRadius` 3, consistent `nodeGap`), gradient links (`lineStyle.color: 'gradient'`, opacity ≈ 0.35), labels beside the node (income left, others right) with name + amount or %, labels hidden for nodes shorter than 10 px, `emphasis.focus: 'adjacency'`, tooltip text in German with amount and share of income, text/tooltip colours from the theme tokens, `animation: !reducedMotion`; unit tests in `apps/web/tests/sankey-option.spec.ts` (order kept, depths, colours, €/% labels, small-node label hidden, links ≤ 0 dropped, reduced motion).

## Phase 3: User Story 1 – Sankey that is pleasant to read (P1) 🎯 MVP

**Goal**: S1–S4 resolved on Budget › Sankey and the Analyse card. **Independent test**: quickstart Q1–Q4.

- [X] T003 [US1] Rewrite `apps/web/app/components/budget/SankeyChart.vue` on `vue-echarts` (`data-testid="sankey-chart"`, client-only with the existing skeleton fallback, width from the card, height as today incl. `maxHeight`), option from `buildSankeyOption`, theme tokens read on mount and on colour-mode change, node click → `select` (same id again → `null`; income/balance → `null`), `selected` node highlighted; props and emits unchanged (contracts/ui.md).
- [X] T004 [US1] Visually hidden block list in `SankeyChart.vue`: one button per main/sub node (`data-testid="sankey-node"`, `data-node="<kind>:<id>"`, label text, `aria-pressed` for the selected one), visible on focus, click/Enter selects like the block; component test `apps/web/tests/sankey-chart.spec.ts` (list rendered in order, select/unselect emits); update `e2e/us-p3-budget.spec.ts` W7 to select via the block list.
- [X] T005 [US1] Check Analyse card and Sankey page in dark and light at 1440 px (labels readable, no overlap for ≥ 15 categories, tooltip in theme); adjust `buildSankeyOption` spacing/sizes if needed; record status in `specs/011-chart-look/quickstart.md`.
- [X] T006 [US1] Remove `d3-sankey` and its types from `apps/web/package.json` once nothing imports it; drop unused helpers/styles from the old drawing (`sankey-link`, `sankey-label` CSS) in `apps/web/app/components/budget/SankeyChart.vue`.

## Phase 4: User Story 2 – All donuts look the same (P2)

**Goal**: one donut look. **Independent test**: quickstart Q5.

- [X] T007 [P] [US2] Single look in `apps/web/app/components/common/DonutChart.vue`: remove the `gaps` prop (always gaps and rounded ends); `apps/web/app/components/budget/CategoryDonut.vue` drops `size`, `thickness`, `gaps` and uses the dashboard centre style (amount `font-semibold`, label `text-xs`, keeping `data-testid="donut-center-label"`); `apps/web/app/components/dividends/DividendSplit.vue` drops `size`/`thickness` and gets the centre slot (total + label, hovered item amount + name); component test `apps/web/tests/donut-look.spec.ts` (same rendered size/ring for the three callers, centre text on Dividenden).

## Phase 5: User Story 3 – Works on every screen size (P3)

**Goal**: no regressions at 375/768/1440 px. **Independent test**: quickstart Q6.

- [ ] T008 [US3] Sankey at 375 and 768 px: fits or scrolls inside its card (no page scroll), labels readable; reduced motion shows no animation; run `e2e/layout-guard.spec.ts` and `e2e/hydration.spec.ts`; fix in `SankeyChart.vue` / `sankey-option.ts` if needed.

## Phase 6: Polish

- [ ] T009 Owner check Q1–Q6 in dark and light; status in `specs/011-chart-look/quickstart.md`.
- [ ] T010 Full gates (`pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`), reading the e2e log for failures; mark spec Status "Implemented".

## Dependencies

- T001 → T002 → T003 → T004 → T005 → T006 (US1 chain).
- T007 (US2) is independent of ECharts and can run any time.
- T008 after T006 and T007. T009, T010 last.

## Parallel Opportunities

- T007 [US2] can be done in parallel with T002–T006 (different files).

## Implementation Strategy

1. MVP: Setup + Foundational + US1 (T001–T006) – new Sankey.
2. US2 (T007) – donuts.
3. US3 + Polish (T008–T010).
