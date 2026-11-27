import { Inject, Injectable } from '@nestjs/common'
import type { OwnerSessionDto } from '@finance/shared'
import { desc, eq, ne } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { ownerSession } from '../../database/schema'
import { SettingsService } from '../settings/settings.service'

/** `last_seen_at` is written at most this often per session. */
const TOUCH_MS = 60_000

/**
 * Owner sessions (014 US4, R3): one row per login; its id lives in the encrypted session
 * cookie. A cookie whose row is gone (logged out elsewhere, password changed, idle too long)
 * no longer counts as logged in.
 */
@Injectable()
export class SessionsService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly settings: SettingsService,
  ) {}

  create(userAgent: string | undefined, now = new Date()): string {
    const at = now.toISOString()
    return this.db
      .insert(ownerSession)
      .values({
        createdAt: at,
        lastSeenAt: at,
        userAgent: userAgent ? userAgent.slice(0, 200) : null,
      })
      .returning({ id: ownerSession.id })
      .get().id
  }

  /** Checks a session and marks it as seen; ends it when it was idle too long. */
  check(id: string, now = new Date()): boolean {
    const row = this.db.select().from(ownerSession).where(eq(ownerSession.id, id)).get()
    if (!row) return false
    const idle = now.getTime() - new Date(row.lastSeenAt).getTime()
    const limit = this.settings.get().autoLogoutMinutes
    if (limit > 0 && idle > limit * 60_000) {
      this.end(id)
      return false
    }
    if (idle > TOUCH_MS) {
      this.db
        .update(ownerSession)
        .set({ lastSeenAt: now.toISOString() })
        .where(eq(ownerSession.id, id))
        .run()
    }
    return true
  }

  list(currentId: string | undefined): OwnerSessionDto[] {
    return this.db
      .select()
      .from(ownerSession)
      .orderBy(desc(ownerSession.lastSeenAt))
      .all()
      .map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        lastSeenAt: row.lastSeenAt,
        userAgent: row.userAgent,
        current: row.id === currentId,
      }))
  }

  end(id: string): void {
    this.db.delete(ownerSession).where(eq(ownerSession.id, id)).run()
  }

  /** "Überall abmelden": every session except the current one. */
  endOthers(currentId: string): number {
    return this.db.delete(ownerSession).where(ne(ownerSession.id, currentId)).run().changes
  }
}
