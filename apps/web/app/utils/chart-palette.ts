/** Categorical chart colors (stable order); "Nicht zugeordnet" is always gray. */
export const CHART_PALETTE = [
  'var(--color-indigo-500)',
  'var(--color-emerald-500)',
  'var(--color-sky-500)',
  'var(--color-amber-500)',
  'var(--color-violet-500)',
  'var(--color-rose-500)',
  'var(--color-teal-500)',
  'var(--color-orange-500)',
  'var(--color-lime-500)',
  'var(--color-fuchsia-500)',
  'var(--color-cyan-500)',
  'var(--color-yellow-600)',
] as const

export const UNASSIGNED_COLOR = 'var(--color-zinc-500)'

export function paletteColor(index: number, key?: string): string {
  if (key === 'unassigned' || key === 'unknown') return UNASSIGNED_COLOR
  return CHART_PALETTE[index % CHART_PALETTE.length]!
}
