/**
 * Default data every installation needs (FR-031). Idempotent: runs on every
 * API start and via `pnpm --filter api db:seed`; existing rows are kept.
 */
import { and, eq, isNull } from 'drizzle-orm'
import type { CategoryKind } from '@finance/shared'
import type { AppDatabase } from './drizzle.module'
import { category, dataSource, institution } from './schema'

type Db = Pick<AppDatabase, 'select' | 'insert'>

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

export const MANUAL_INSTITUTION = 'Manuell'

function ensureCategory(
  db: Db,
  name: string,
  kind: CategoryKind,
  color: string,
  parentId: string | null,
): string {
  const existing = db
    .select({ id: category.id })
    .from(category)
    .where(
      and(
        eq(category.name, name),
        parentId ? eq(category.parentId, parentId) : isNull(category.parentId),
      ),
    )
    .get()
  if (existing) return existing.id
  return db
    .insert(category)
    .values({ name, kind, color, parentId, isDefault: true })
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
    .values([
      { id: 'csv', kind: 'csv', status: 'active', displayName: 'CSV-Import' },
      {
        id: 'sparkasse_fints',
        kind: 'sparkasse_fints',
        status: 'planned',
        displayName: 'Sparkasse (Live-Abfrage)',
      },
    ])
    .onConflictDoNothing()
    .run()
}
