# Data Model: Chart Look (011)

No storage or API change. The web layer maps existing data:

## Sankey graph (from `GET /api/cashflow/sankey`, unchanged)

| Field | Use |
|---|---|
| `nodes[].id`, `label`, `kind` (`income` \| `main` \| `sub` \| `balance`) | ECharts node `name` (id), display label, column (`depth` 0/1/2, balance 1), colour |
| `links[].source`, `target`, `valueCents` | ECharts link; links with `valueCents ≤ 0` dropped as today |

Colours: income and balance keep today's fixed colours; main = category colour; sub = lighter shade of its main colour (`useCategoryAppearance`).

## Donut item (unchanged)

`{ key, value (cents), color, label }`.
