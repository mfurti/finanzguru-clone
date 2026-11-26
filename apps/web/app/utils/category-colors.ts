/**
 * One color per category (research R9): the stored `category.color` key maps to
 * a soft pastel tone, used by list, donut, Sankey, bars and detail alike.
 * Unknown keys fall back to a stable palette slot derived from the key.
 */
export const CATEGORY_COLORS: Record<string, string> = {
  indigo: '#8f93f2',
  violet: '#b49af0',
  purple: '#c39be8',
  fuchsia: '#e39ed6',
  pink: '#f19bc0',
  rose: '#ee8f96',
  red: '#ef8a80',
  orange: '#f4a582',
  amber: '#f0c870',
  yellow: '#ecd97a',
  lime: '#a9db7b',
  green: '#8fd49a',
  emerald: '#6fd9ad',
  teal: '#6ccfc4',
  cyan: '#74cfe3',
  sky: '#82c3f0',
  blue: '#8fb0f4',
  slate: '#a3b1c4',
  gray: '#b0b4bb',
  zinc: '#b0b0b8',
  neutral: '#b3b3b3',
}

const ORDER = Object.keys(CATEGORY_COLORS).filter(
  (key) => !['gray', 'zinc', 'neutral'].includes(key),
)

/** Keys offered in the category settings (one swatch each). */
export const CATEGORY_COLOR_KEYS = Object.keys(CATEGORY_COLORS)

function hash(value: string): number {
  let h = 0
  for (const char of value) h = (h * 31 + char.charCodeAt(0)) >>> 0
  return h
}

/** Hex color for a stored color key; stable for unknown keys. */
export function categoryHex(key: string | null | undefined): string {
  if (!key) return CATEGORY_COLORS.neutral!
  return CATEGORY_COLORS[key] ?? CATEGORY_COLORS[ORDER[hash(key) % ORDER.length]!]!
}

/** Same hue, lighter for deeper levels (sub categories in the Sankey). */
export function shadeHex(hex: string, depth: number): string {
  if (depth <= 0) return hex
  const amount = Math.min(0.6, depth * 0.22)
  return `color-mix(in oklab, ${hex} ${Math.round((1 - amount) * 100)}%, white)`
}

/** Stable color for any name (avatars, tags without a color). */
export function nameHex(name: string): string {
  return CATEGORY_COLORS[ORDER[hash(name.toLowerCase()) % ORDER.length]!]!
}
