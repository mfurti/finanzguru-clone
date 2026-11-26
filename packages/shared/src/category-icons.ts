/**
 * Selectable category icons (Lucide keys, served locally through Iconify) with
 * German labels. The API validates `category.icon` against this list (R8).
 */
export const CATEGORY_ICONS = {
  tag: 'Allgemein',
  house: 'Wohnen',
  'shopping-cart': 'Einkauf',
  utensils: 'Essen',
  car: 'Auto',
  bus: 'Bus',
  'train-front': 'Bahn',
  plane: 'Reisen',
  fuel: 'Tanken',
  'heart-pulse': 'Gesundheit',
  pill: 'Apotheke',
  shield: 'Versicherung',
  'piggy-bank': 'Sparen',
  'trending-up': 'Investieren',
  banknote: 'Bargeld',
  'hand-coins': 'Einkommen',
  landmark: 'Bank & Staat',
  receipt: 'Rechnungen',
  briefcase: 'Arbeit',
  gift: 'Geschenke',
  shirt: 'Kleidung',
  scissors: 'Pflege',
  'graduation-cap': 'Bildung',
  book: 'Bücher',
  baby: 'Kinder',
  dog: 'Haustiere',
  dumbbell: 'Sport',
  film: 'Kino & Streaming',
  music: 'Musik',
  'gamepad-2': 'Spiele',
  coffee: 'Café',
  beer: 'Ausgehen',
  phone: 'Telefon',
  wifi: 'Internet',
  zap: 'Strom',
  droplet: 'Wasser',
  flame: 'Heizung',
  wrench: 'Reparaturen',
  sofa: 'Einrichtung',
  'arrow-left-right': 'Umbuchung',
} as const

export type CategoryIcon = keyof typeof CATEGORY_ICONS
export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICONS) as CategoryIcon[]
export const DEFAULT_CATEGORY_ICON: CategoryIcon = 'tag'

export function isCategoryIcon(key: string): key is CategoryIcon {
  return Object.hasOwn(CATEGORY_ICONS, key)
}
