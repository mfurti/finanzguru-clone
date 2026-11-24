import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import {
  transactionFilter,
  type TransactionBulkInput,
  type TransactionBulkResult,
} from '@finance/shared'
import { and, eq, inArray } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { category, tag, transaction, transactionTag } from '../../database/schema'
import { TransactionsReviewService } from './transactions-review.service'
import { TransactionsTrashService } from './transactions-trash.service'

const CHUNK = 500
const chunks = <T>(items: readonly T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) =>
    items.slice(i * CHUNK, (i + 1) * CHUNK),
  )

/**
 * Bulk actions of the transactions table (FR-005, research R2): on selected
 * ids or on every row matching the table's filter.
 */
@Injectable()
export class TransactionsBulkService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly review: TransactionsReviewService,
    private readonly trash: TransactionsTrashService,
  ) {}

  run(input: TransactionBulkInput): TransactionBulkResult {
    const ids = input.ids ?? this.idsForFilter(input.filter!)
    if (ids.length === 0) return { affected: 0 }
    switch (input.action) {
      case 'delete':
        return this.trash.remove(ids)
      case 'markReviewed':
        return { affected: this.update(ids, { reviewStatus: 'reviewed' }) }
      case 'setCategory': {
        const categoryId = this.single(input.value)
        if (categoryId && !this.exists(category, categoryId)) {
          throw new BadRequestException('Kategorie nicht gefunden')
        }
        return {
          affected: this.update(ids, {
            categoryId,
            categorySource: categoryId ? 'manual' : null,
            reviewStatus: 'reviewed',
          }),
        }
      }
      case 'addTags':
      case 'removeTags': {
        const tagIds = this.list(input.value)
        const known = this.db.select({ id: tag.id }).from(tag).where(inArray(tag.id, tagIds)).all()
        if (known.length !== tagIds.length) throw new BadRequestException('Tag nicht gefunden')
        const existing = this.existingIds(ids)
        this.db.transaction((tx) => {
          for (const part of chunks(existing)) {
            if (input.action === 'addTags') {
              tx.insert(transactionTag)
                .values(
                  part.flatMap((transactionId) =>
                    tagIds.map((tagId) => ({ transactionId, tagId })),
                  ),
                )
                .onConflictDoNothing()
                .run()
            } else {
              tx.delete(transactionTag)
                .where(
                  and(
                    inArray(transactionTag.transactionId, part),
                    inArray(transactionTag.tagId, tagIds),
                  ),
                )
                .run()
            }
          }
        })
        return { affected: existing.length }
      }
    }
  }

  /** All ids matching a table filter (strings as in the query string). */
  private idsForFilter(raw: Record<string, string>): string[] {
    const parsed = transactionFilter.safeParse(raw)
    if (!parsed.success) throw new BadRequestException('Filter ist ungültig')
    const where = this.review.whereFor(parsed.data)
    if (where === null) return []
    return this.db
      .select({ id: transaction.id })
      .from(transaction)
      .leftJoin(category, eq(category.id, transaction.categoryId))
      .where(where)
      .all()
      .map((row) => row.id)
  }

  private existingIds(ids: readonly string[]): string[] {
    return chunks([...new Set(ids)]).flatMap((part) =>
      this.db
        .select({ id: transaction.id })
        .from(transaction)
        .where(inArray(transaction.id, part))
        .all()
        .map((row) => row.id),
    )
  }

  private update(ids: readonly string[], values: Partial<typeof transaction.$inferInsert>): number {
    const existing = this.existingIds(ids)
    this.db.transaction((tx) => {
      for (const part of chunks(existing)) {
        tx.update(transaction).set(values).where(inArray(transaction.id, part)).run()
      }
    })
    return existing.length
  }

  private single(value: TransactionBulkInput['value']): string | null {
    if (value === null || value === undefined || value === '') return null
    if (typeof value !== 'string') throw new BadRequestException('Ein Wert erwartet')
    return value
  }

  private list(value: TransactionBulkInput['value']): string[] {
    const items = typeof value === 'string' ? [value] : (value ?? [])
    if (items.length === 0) throw new BadRequestException('Mindestens ein Tag erwartet')
    return [...new Set(items)]
  }

  private exists(table: typeof category, id: string): boolean {
    return !!this.db.select({ id: table.id }).from(table).where(eq(table.id, id)).get()
  }
}
