# Research: Chart Look (011)

## R1 – Sankey library

- **Decision**: Apache ECharts 6.1.0 `sankey` series via `vue-echarts` 8.3.2 (peer `echarts ^6`), imported tree-shaken: `echarts/core` with `SankeyChart`, `TooltipComponent`, `SVGRenderer`.
- **Rationale**: owner's choice; mature sankey with gradient links (`lineStyle.color: 'gradient'`), adjacency emphasis (`emphasis.focus: 'adjacency'`), outside labels, rounded nodes (`itemStyle.borderRadius`), node gap/width settings, built-in tooltip, animation that can be switched off. Apache-2.0 licence. SVG renderer keeps text crisp and the chart inspectable.
- **Alternatives**: keep d3-sankey and restyle (owner wants ECharts); Unovis/Plotly (heavier, less control over order); canvas renderer (blurry text when zoomed, nothing to inspect in tests).

## R2 – Keeping the crossing-free order

- **Decision**: pass nodes in the order from `sankeyOrder()` and set `layoutIterations: 0`, so ECharts keeps the input order within each column; `nodeAlign: 'justify'` with explicit `depth` per node (income 0, main 1, sub 2, balance 1).
- **Rationale**: ECharts' relaxation reorders nodes when iterations > 0; with 0 it keeps data order, which `sankeyOrder` already makes crossing-free.
- **Alternatives**: let ECharts optimise (can produce crossings and reorder categories between months).

## R3 – Client-only rendering and theme

- **Decision**: render inside `<ClientOnly>` with the existing skeleton fallback; read colours from CSS tokens (`--ui-text`, `--ui-text-muted`, `--ui-bg-elevated`, `--ui-border`) at mount and on colour-mode change, rebuild the option.
- **Rationale**: ECharts needs the DOM; SSR rendering is possible but adds complexity for no gain on a private app. Tokens keep dark/light consistent with the rest of the app.
- **Alternatives**: ECharts SSR string rendering (more code, hydration care); a fixed ECharts theme (would drift from app tokens).

## R4 – Labels on small blocks

- **Decision**: label = name + amount (or %) to the right of main/sub nodes and to the left of the income node; hide the label of blocks shorter than 10 px (label still in tooltip and in the block list).
- **Rationale**: avoids overlap (SC-002) without dropping information.

## R5 – Tests and keyboard access

- **Decision**: visually hidden list of buttons (one per main/sub block, `data-testid="sankey-node"`, `data-node`, label text), visible on focus; Enter/click selects like a block click. The option builder is a pure function with unit tests. The 003 e2e filter test clicks via this list.
- **Rationale**: ECharts SVG has no stable per-node elements or data attributes; the list gives keyboard users and tests the same path.
- **Alternatives**: clicking by pixel coordinates in e2e (brittle); dispatching ECharts events from tests (tests the library, not the page).

## R6 – One donut look

- **Decision**: the dashboard donut (DonutChart defaults: 176 px, ring 22 px, gaps and rounded ends, centre amount `font-semibold`, label `text-xs`) is the only look; `gaps` and the size overrides are removed from call sites; DividendSplit gets the centre slot.
- **Rationale**: owner's instruction; supersedes 007 R6 (no-gap budget donut).
