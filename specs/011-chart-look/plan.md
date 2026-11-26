# Implementation Plan: Chart Look – Sankey Redrawn, Donuts Made Uniform

**Branch**: `15-chart-look-sankey-on-apache-echarts-one-donut-look-011` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-chart-look/spec.md`

## Summary

1. **Sankey on Apache ECharts (US1)**: `SankeyChart.vue` keeps its props (`graph`, `incomeCents`, `unit`, `selected`, `maxHeight`) and its `select` emit, so `pages/budget/sankey.vue` and `pages/budget/index.vue` stay unchanged. Inside, a pure option builder (`utils/sankey-option.ts`) turns the graph into an ECharts sankey series: nodes in the existing crossing-free order (`utils/sankey-order.ts`, layout iterations 0), category colours, gradient links, slim rounded nodes with outside labels, adjacency emphasis, tooltip with amount and share. Rendered client-only with `vue-echarts` and the tree-shaken SVG renderer.
2. **Keyboard and test access**: ECharts draws plain SVG without per-node elements, so the component renders a visually hidden list of buttons, one per category block (`data-testid="sankey-node"`, `data-node`), that becomes visible on focus. It selects like a click on the block; the existing e2e test uses it.
3. **One donut look (US2)**: `DonutChart.vue` defaults (176 px, ring 22 px, gaps and rounded ends, centre `font-semibold` amount + `text-xs` label) become the only look: `CategoryDonut` drops `size`/`thickness`/`gaps` and its large centre text; `DividendSplit` drops `size`/`thickness` and gets the centre slot (total + hovered item). The `gaps` prop is removed.
4. **Guards (US3)**: layout guard and hydration check over all pages; `d3-sankey` removed once nothing imports it.

## Technical Context

**Language/Version**: TypeScript 5 strict, Vue 3.5, Nuxt 4

**Primary Dependencies**: new in `apps/web`: `echarts` 6.1.0 and `vue-echarts` 8.3.2 (both Apache-2.0, exact pins). Removed: `d3-sankey` (and its types) after T006. `d3-shape` stays (donuts).

**Storage**: none.

**Testing**: vitest unit tests for the option builder (order, colours, labels in €/%, small-block label hiding, theme colours); component tests for SankeyChart (hidden block list, select emit) and donuts (same props/look); Playwright: existing Sankey filter test (via the block list), layout guard, hydration check.

**Target Platform**: local dev server (web 3100, API 3101).

**Project Type**: pnpm monorepo web app.

**Performance Goals**: Sankey appears within the current page load; tree-shaken ECharts chunk loaded only on pages with a Sankey (lazy component).

**Constraints**: client-only rendering (ECharts needs the DOM), skeleton during SSR as today; colours from app tokens read at runtime so dark/light switch redraws; reduced motion → `animation: false`.

**Scale/Scope**: 1 chart component rewritten, 1 new utility, 3 donut call sites, 2 dependencies added, 1 removed.

## Coding Standards

Same as feature 005 (`specs/005-bank-sync-market-data/plan.md` › Coding Standards). Gates per task commit: lint, format check, typecheck, API and web unit tests.

## Constitution Check

| Principle | Check | Status |
|---|---|---|
| I. Exact Money | Amounts stay integer cents; labels formatted with the shared `formatEur`/`formatPct` | Pass |
| II. Owner-Controlled, Local Data | No data leaves the app; ECharts bundled, no CDN | Pass |
| III. Public Repo Hygiene | No private data; licences Apache-2.0 | Pass |
| IV. Tested by Layer | Unit (option builder), component (Sankey, donuts), Playwright (filter, layout, hydration) | Pass |
| V. Local First | Local dev server; no deployment | Pass |
| VI. German, Responsive, Honest UI | German labels and tooltip, works at 375/768/1440, dark/light, reduced motion, keyboard access to blocks | Pass |

Post-design re-check: unchanged.

## Project Structure

```text
specs/011-chart-look/ plan.md research.md data-model.md quickstart.md contracts/ui.md tasks.md

apps/web/package.json                               # + echarts, vue-echarts; − d3-sankey
apps/web/app/utils/sankey-option.ts                 # pure graph → ECharts option builder
apps/web/app/components/budget/SankeyChart.vue      # ECharts render + hidden block list
apps/web/app/components/common/DonutChart.vue       # single look, gaps prop removed
apps/web/app/components/budget/CategoryDonut.vue    # no overrides
apps/web/app/components/dividends/DividendSplit.vue # no overrides, centre slot
apps/web/tests/{sankey-option.spec.ts,sankey-chart.spec.ts,donut-look.spec.ts}
e2e/us-p3-budget.spec.ts                            # click via block list
```

## Complexity Tracking

No violations.
