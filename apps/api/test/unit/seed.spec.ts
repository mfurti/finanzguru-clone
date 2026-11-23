import { isNull } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { category, dataSource, institution } from '../../src/database/schema'
import { DEFAULT_CATEGORIES, seedDefaults } from '../../src/database/seed'
import { createTestDb } from '../helpers/test-db'

describe('seedDefaults', () => {
  it('creates the German category tree, Manuell and the default sources', () => {
    const db = createTestDb()
    seedDefaults(db)

    const mains = db.select().from(category).where(isNull(category.parentId)).all()
    expect(mains.map((row) => row.name)).toEqual(DEFAULT_CATEGORIES.map((row) => row.name))
    expect(mains.every((row) => row.isDefault)).toBe(true)

    const all = db.select().from(category).all()
    const wohnen = mains.find((row) => row.name === 'Wohnen')!
    expect(all.filter((row) => row.parentId === wohnen.id).map((row) => row.name)).toEqual([
      'Miete / Wohngeld',
      'Strom',
      'Wohnnebenkosten',
    ])
    expect(mains.find((row) => row.name === 'Einnahmen')?.kind).toBe('income')
    expect(mains.find((row) => row.name === 'Sparen und Anlegen')?.kind).toBe('savings')

    expect(
      db
        .select()
        .from(institution)
        .all()
        .map((row) => row.name),
    ).toEqual(['Manuell'])
    expect(
      db
        .select()
        .from(dataSource)
        .all()
        .map((row) => [row.id, row.status]),
    ).toEqual([
      ['csv', 'active'],
      ['sparkasse_fints', 'planned'],
    ])
  })

  it('is idempotent', () => {
    const db = createTestDb()
    seedDefaults(db)
    const before = db.select().from(category).all().length
    seedDefaults(db)
    expect(db.select().from(category).all()).toHaveLength(before)
    expect(db.select().from(dataSource).all()).toHaveLength(2)
  })
})
