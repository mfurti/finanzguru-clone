/**
 * Default data every installation needs (FR-031). Idempotent: runs on every
 * API start and via `pnpm --filter api db:seed`; existing rows are kept.
 */
import { and, eq, isNull } from 'drizzle-orm'
import type { CategoryKind } from '@finance/shared'
import type { AppDatabase } from './drizzle.module'
import { WIDGET_KEYS } from '@finance/shared'
import { category, dashboardLayout, dataSource, institution } from './schema'

type Db = Pick<AppDatabase, 'select' | 'insert' | 'update' | 'delete'>

interface CategorySeed {
  name: string
  kind: CategoryKind
  color: string
  children?: string[]
}

/** German default category tree (main › sub). */
export const DEFAULT_CATEGORIES: readonly CategorySeed[] = [
  {
    name: 'Wohnen',
    kind: 'expense',
    color: 'blue',
    children: ['Miete / Wohngeld', 'Strom', 'Wohnnebenkosten'],
  },
  {
    name: 'Lebenshaltung',
    kind: 'expense',
    color: 'emerald',
    children: ['Lebensmittel und Getränke', 'Handy', 'Festnetz und Internet', 'Sonstige'],
  },
  {
    name: 'Shopping und Unterhaltung',
    kind: 'expense',
    color: 'pink',
    children: ['Büromaterial', 'Kleidung', 'Elektronik', 'Streaming'],
  },
  { name: 'Sparen und Anlegen', kind: 'savings', color: 'violet', children: ['Wertpapieranlage'] },
  {
    name: 'Versicherung',
    kind: 'expense',
    color: 'amber',
    children: ['Risiko-Lebensversicherung'],
  },
  { name: 'Bank und Kredit', kind: 'expense', color: 'slate', children: ['Kontoführung'] },
  {
    name: 'Gesundheit und Wellness',
    kind: 'expense',
    color: 'teal',
    children: ['Arznei- und Heilmittel'],
  },
  {
    name: 'Freizeit, Hobbies und Soziales',
    kind: 'expense',
    color: 'orange',
    children: ['Freizeitaktivitäten'],
  },
  {
    name: 'Einnahmen',
    kind: 'income',
    color: 'green',
    children: ['Gehalt', 'Sonstige Einnahmen'],
  },
  { name: 'Umbuchung', kind: 'transfer', color: 'neutral' },
]

/** Default icons (003 US3); keys from CATEGORY_ICONS. Unlisted names keep `tag`. */
export const DEFAULT_CATEGORY_ICONS: Readonly<Record<string, string>> = {
  Wohnen: 'house',
  'Miete / Wohngeld': 'house',
  Strom: 'zap',
  Wohnnebenkosten: 'flame',
  Lebenshaltung: 'shopping-cart',
  'Lebensmittel und Getränke': 'shopping-cart',
  Handy: 'phone',
  'Festnetz und Internet': 'wifi',
  'Shopping und Unterhaltung': 'gift',
  Büromaterial: 'briefcase',
  Kleidung: 'shirt',
  Elektronik: 'gamepad-2',
  Streaming: 'film',
  'Sparen und Anlegen': 'piggy-bank',
  Wertpapieranlage: 'trending-up',
  Versicherung: 'shield',
  'Risiko-Lebensversicherung': 'shield',
  'Bank und Kredit': 'landmark',
  Kontoführung: 'receipt',
  'Gesundheit und Wellness': 'heart-pulse',
  'Arznei- und Heilmittel': 'pill',
  'Freizeit, Hobbies und Soziales': 'dumbbell',
  Freizeitaktivitäten: 'dumbbell',
  Einnahmen: 'hand-coins',
  Gehalt: 'briefcase',
  'Sonstige Einnahmen': 'banknote',
  Umbuchung: 'arrow-left-right',
}

export const MANUAL_INSTITUTION = 'Manuell'

function ensureCategory(
  db: Db,
  name: string,
  kind: CategoryKind,
  color: string,
  parentId: string | null,
): string {
  const icon = DEFAULT_CATEGORY_ICONS[name] ?? 'tag'
  const existing = db
    .select({ id: category.id, icon: category.icon })
    .from(category)
    .where(
      and(
        eq(category.name, name),
        parentId ? eq(category.parentId, parentId) : isNull(category.parentId),
      ),
    )
    .get()
  if (existing) {
    // Databases from before 003 have no icons yet; owner choices (≠ 'tag') stay.
    if (existing.icon === 'tag' && icon !== 'tag') {
      db.update(category).set({ icon }).where(eq(category.id, existing.id)).run()
    }
    return existing.id
  }
  return db
    .insert(category)
    .values({ name, kind, color, icon, parentId, isDefault: true })
    .returning()
    .get().id
}

export function seedDefaults(db: Db): void {
  for (const main of DEFAULT_CATEGORIES) {
    const parentId = ensureCategory(db, main.name, main.kind, main.color, null)
    for (const child of main.children ?? []) {
      ensureCategory(db, child, main.kind, main.color, parentId)
    }
  }

  db.insert(institution).values({ name: MANUAL_INSTITUTION }).onConflictDoNothing().run()

  db.insert(dataSource)
    .values([{ id: 'csv', kind: 'csv', status: 'active', displayName: 'CSV-Import' }])
    .onConflictDoNothing()
    .run()
  // The FinTS placeholder is replaced by the Enable Banking source (005); drop the unused row.
  db.delete(dataSource)
    .where(and(eq(dataSource.id, 'sparkasse_fints'), eq(dataSource.status, 'planned')))
    .run()

  db.insert(dashboardLayout)
    .values(WIDGET_KEYS.map((widgetKey, position) => ({ widgetKey, position, visible: true })))
    .onConflictDoNothing()
    .run()
}
