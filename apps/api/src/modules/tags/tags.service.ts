import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { TagDto, TagInput, UpdateTagInput } from '@finance/shared'
import { and, asc, count, eq, ne, sql } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { tag, transactionTag } from '../../database/schema'

/** Free-text tags on bookings (003 US1, research R4). Names are unique ignoring case. */
@Injectable()
export class TagsService {
  constructor(@Inject(DB) private readonly db: AppDatabase) {}

  list(): TagDto[] {
    return this.db
      .select({ id: tag.id, name: tag.name, color: tag.color, usage: count(transactionTag.tagId) })
      .from(tag)
      .leftJoin(transactionTag, eq(transactionTag.tagId, tag.id))
      .groupBy(tag.id)
      .orderBy(asc(sql`lower(${tag.name})`))
      .all()
  }

  create(input: TagInput): TagDto {
    this.assertFree(input.name)
    const row = this.db.insert(tag).values(input).returning().get()
    return { id: row.id, name: row.name, color: row.color, usage: 0 }
  }

  update(id: string, input: UpdateTagInput): TagDto {
    this.get(id)
    if (input.name) this.assertFree(input.name, id)
    this.db.update(tag).set(input).where(eq(tag.id, id)).run()
    return this.list().find((item) => item.id === id)!
  }

  /** Deletes the tag; its links go with it (cascade), the bookings stay. */
  remove(id: string): void {
    this.get(id)
    this.db.delete(tag).where(eq(tag.id, id)).run()
  }

  private get(id: string) {
    const row = this.db.select().from(tag).where(eq(tag.id, id)).get()
    if (!row) throw new NotFoundException('Tag nicht gefunden')
    return row
  }

  private assertFree(name: string, exceptId?: string): void {
    const clash = this.db
      .select({ id: tag.id })
      .from(tag)
      .where(
        and(
          eq(sql`lower(${tag.name})`, name.trim().toLowerCase()),
          exceptId ? ne(tag.id, exceptId) : undefined,
        ),
      )
      .get()
    if (clash) throw new ConflictException('Tag existiert bereits')
  }
}
