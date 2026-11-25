import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { category, ruleSuggestion } from '../../src/database/schema'
import { seedDefaults } from '../../src/database/seed'
import { createTestDb } from '../helpers/test-db'

describe('feature 006 schema (migration 0009)', () => {
  const setup = () => {
    const db = createTestDb()
    seedDefaults(db)
    const cat = db.select().from(category).get()!
    return { db, cat }
  }

  it('stores one suggestion per recipient and category', () => {
    const { db, cat } = setup()
    db.insert(ruleSuggestion).values({ counterpartyKey: 'stadtwerke', categoryId: cat.id }).run()
    expect(db.select().from(ruleSuggestion).get()).toMatchObject({ count: 0, status: 'open' })
    expect(() =>
      db.insert(ruleSuggestion).values({ counterpartyKey: 'stadtwerke', categoryId: cat.id }).run(),
    ).toThrow(/UNIQUE/)
  })

  it('checks key length, count and status', () => {
    const { db, cat } = setup()
    expect(() =>
      db.insert(ruleSuggestion).values({ counterpartyKey: '', categoryId: cat.id }).run(),
    ).toThrow(/rule_suggestion_key_len/)
    expect(() =>
      db
        .insert(ruleSuggestion)
        .values({ counterpartyKey: 'a', categoryId: cat.id, count: -1 })
        .run(),
    ).toThrow(/rule_suggestion_count/)
    expect(() =>
      db
        .insert(ruleSuggestion)
        .values({ counterpartyKey: 'b', categoryId: cat.id, status: 'maybe' as never })
        .run(),
    ).toThrow(/rule_suggestion_status/)
  })

  it('drops suggestions with their category', () => {
    const { db } = setup()
    const own = db
      .insert(category)
      .values({ name: 'Testkategorie', kind: 'expense', color: 'neutral' })
      .returning()
      .get()
    db.insert(ruleSuggestion).values({ counterpartyKey: 'x', categoryId: own.id }).run()
    db.delete(category).where(eq(category.id, own.id)).run()
    expect(db.select().from(ruleSuggestion).all()).toEqual([])
  })
})
