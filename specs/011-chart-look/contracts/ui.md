# UI Contract: Chart Look (011)

## `SankeyChart.vue` (unchanged interface)

| Prop / emit | Meaning |
|---|---|
| `graph: SankeyResponse` | nodes and links |
| `incomeCents: number` | base for shares |
| `unit: 'eur' \| 'pct'` | label and tooltip format |
| `selected?: string \| null` | selected category id (highlighted) |
| `maxHeight?: number` | height limit (Analyse card compact) |
| `select(categoryId \| null)` | block click / block list button; same id again → `null` |

Test ids: `sankey` (root), `sankey-node` with `data-node="<kind>:<id>"` (block list button), `sankey-chart` (ECharts container).

## `DonutChart.vue`

Props `items`, `duration`; v-model `hovered`; emit `select`; slot `center({ item })`. `size`, `thickness` and `gaps` are no longer set by callers (`gaps` removed). Test ids unchanged (`donut-slice`, `donut-center-label` where the caller sets it).
