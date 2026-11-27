import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { account, institution, ownerSession } from '../../src/database/schema'
import { createTestDb } from '../helpers/test-db'

describe('feature 014 schema (migration 0015)', () => {
  it('stores sessions with defaults and caps the user agent at 200 chars', () => {
    const db = createTestDb()
    const row = db
      .insert(ownerSession)
      .values({ userAgent: 'x'.repeat(200) })
      .returning()
      .get()
    expect(row.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(row.lastSeenAt).toBe(row.createdAt)
    db.insert(ownerSession).values({}).run()
    expect(() =>
      db
        .insert(ownerSession)
        .values({ userAgent: 'x'.repeat(201) })
        .run(),
    ).toThrow(/session_user_agent_len/)
  })

  it('adds a nullable archived_at to accounts', () => {
    const db = createTestDb()
    const bank = db.insert(institution).values({ name: 'Bank' }).returning().get()
    const created = db
      .insert(account)
      .values({ institutionId: bank.id, name: 'Giro', type: 'checking' })
      .returning()
      .get()
    expect(created.archivedAt).toBeNull()
    db.update(account)
      .set({ archivedAt: '2026-11-27T10:00:00.000Z' })
      .where(eq(account.id, created.id))
      .run()
    expect(db.select().from(account).get()?.archivedAt).toBe('2026-11-27T10:00:00.000Z')
  })
})
