import { GoneException, Inject, Injectable } from '@nestjs/common'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { uuidv7 } from 'uuidv7'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { account, deletedImportMarker, transaction, transactionTag } from '../../database/schema'
import { todayIso } from '../../domain/period'
import { RecomputeService } from '../import/recompute.service'

/** How long a delete can be undone (FR-005). */
export const UNDO_WINDOW_MS = 10_000

type Row = typeof transaction.$inferSelect
type Link = typeof transactionTag.$inferSelect
interface Entry {
  rows: Row[]
  links: Link[]
  expiresAt: number
}

/** Rows per IN (...) list; SQLite allows 32766 bound parameters. */
const CHUNK = 500
const chunks = <T>(items: readonly T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) =>
    items.slice(i * CHUNK, (i + 1) * CHUNK),
  )

/**
 * Deletes bookings for real and keeps a copy for 10 s so the owner can undo
 * (research R2). Because deleted rows are really gone, no read path needs a
 * filter. Imported rows leave a marker so a re-import skips them (FR-007).
 * A cash booking that is already booked changes the account balance, exactly
 * like creating it did (see TransactionsWriteService).
 */
@Injectable()
export class TransactionsTrashService {
  private readonly store = new Map<string, Entry>()

  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly recompute: RecomputeService,
  ) {}

  /** Deletes the given bookings; returns the number deleted and an undo token. */
  remove(ids: readonly string[], now = Date.now()): { affected: number; undoToken?: string } {
    this.expire(now)
    const unique = [...new Set(ids)]
    if (unique.length === 0) return { affected: 0 }
    const rows = chunks(unique).flatMap((part) =>
      this.db.select().from(transaction).where(inArray(transaction.id, part)).all(),
    )
    if (rows.length === 0) return { affected: 0 }
    const rowIds = rows.map((row) => row.id)
    const links = chunks(rowIds).flatMap((part) =>
      this.db
        .select()
        .from(transactionTag)
        .where(inArray(transactionTag.transactionId, part))
        .all(),
    )

    this.db.transaction((tx) => {
      for (const part of chunks(rowIds)) {
        tx.delete(transaction).where(inArray(transaction.id, part)).run()
      }
      const imported = rows.filter((row) => row.source !== 'manual')
      for (const row of imported) {
        tx.insert(deletedImportMarker)
          .values({ source: row.source, fingerprint: row.fingerprint, sourceRef: row.sourceRef })
          .onConflictDoNothing()
          .run()
      }
      this.adjustBalances(tx, rows, -1)
      this.recomputeFor(tx, rows)
    })

    const undoToken = uuidv7()
    this.store.set(undoToken, { rows, links, expiresAt: now + UNDO_WINDOW_MS })
    return { affected: rows.length, undoToken }
  }

  /** Puts deleted bookings back; 410 once the undo window has passed. */
  restore(token: string, now = Date.now()): { restored: number } {
    this.expire(now)
    const entry = this.store.get(token)
    if (!entry) throw new GoneException('Rückgängig ist nicht mehr möglich')
    this.store.delete(token)

    this.db.transaction((tx) => {
      for (const part of chunks(entry.rows)) tx.insert(transaction).values(part).run()
      for (const part of chunks(entry.links)) {
        tx.insert(transactionTag).values(part).onConflictDoNothing().run()
      }
      for (const row of entry.rows.filter((r) => r.source !== 'manual')) {
        tx.delete(deletedImportMarker)
          .where(
            and(
              eq(deletedImportMarker.source, row.source),
              eq(deletedImportMarker.fingerprint, row.fingerprint),
            ),
          )
          .run()
      }
      this.adjustBalances(tx, entry.rows, 1)
      this.recomputeFor(tx, entry.rows)
    })
    return { restored: entry.rows.length }
  }

  private expire(now: number): void {
    for (const [token, entry] of this.store) if (entry.expiresAt <= now) this.store.delete(token)
  }

  private adjustBalances(tx: Pick<AppDatabase, 'select' | 'update'>, rows: Row[], sign: 1 | -1) {
    const today = todayIso()
    const byAccount = new Map<string, number>()
    for (const row of rows) {
      if (row.bookingDate > today) continue
      byAccount.set(row.accountId, (byAccount.get(row.accountId) ?? 0) + row.amountCents)
    }
    for (const [accountId, cents] of byAccount) {
      const acc = tx
        .select({ type: account.type })
        .from(account)
        .where(eq(account.id, accountId))
        .get()
      if (!acc || acc.type === 'depot') continue
      tx.update(account)
        .set({ balanceCents: sql`${account.balanceCents} + ${sign * cents}` })
        .where(eq(account.id, accountId))
        .run()
    }
  }

  private recomputeFor(tx: Parameters<RecomputeService['recompute']>[0], rows: Row[]): void {
    const accountIds = [...new Set(rows.map((row) => row.accountId))]
    const from = rows.reduce((min, row) => (row.bookingDate < min ? row.bookingDate : min), '9999')
    this.recompute.recompute(tx, accountIds, from)
  }
}
