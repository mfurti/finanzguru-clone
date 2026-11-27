import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { owner } from '../../database/schema'
import { hashPassword, verifyPassword } from './password'

@Injectable()
export class AuthService {
  constructor(@Inject(DB) private readonly db: AppDatabase) {}

  /** True if an owner exists and the password matches. */
  async verify(password: string): Promise<boolean> {
    const row = this.db.select().from(owner).where(eq(owner.id, 'owner')).get()
    if (!row) {
      // Spend comparable time so a missing owner is not observable.
      await hashPassword(password)
      return false
    }
    return verifyPassword(password, row.passwordHash)
  }

  displayName(): string | undefined {
    return this.db
      .select({ displayName: owner.displayName })
      .from(owner)
      .where(eq(owner.id, 'owner'))
      .get()?.displayName
  }

  /** New password for the existing owner (014 Einstellungen › Sicherheit). */
  async changePassword(password: string): Promise<void> {
    const passwordHash = await hashPassword(password)
    this.db.update(owner).set({ passwordHash }).where(eq(owner.id, 'owner')).run()
  }

  /** Creates or replaces the single owner (CLI `owner:set-password`). */
  async setOwner(displayName: string, password: string): Promise<void> {
    const passwordHash = await hashPassword(password)
    this.db
      .insert(owner)
      .values({ id: 'owner', displayName, passwordHash })
      .onConflictDoUpdate({ target: owner.id, set: { displayName, passwordHash } })
      .run()
  }
}
