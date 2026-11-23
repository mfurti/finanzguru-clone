import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type {
  GroupingDto,
  GroupingInput,
  GroupingMembersInput,
  InflationRates,
} from '@finance/shared'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import {
  customGroup,
  customGrouping,
  customGroupMember,
  inflationRate,
  instrument,
} from '../../database/schema'

/** Owner-defined groupings ("Eigene Aufteilung") and yearly inflation rates (US1). */
@Injectable()
export class GroupingsService {
  constructor(@Inject(DB) private readonly db: AppDatabase) {}

  list(): GroupingDto[] {
    const groupings = this.db.select().from(customGrouping).orderBy(asc(customGrouping.name)).all()
    const groups = this.db.select().from(customGroup).orderBy(asc(customGroup.position)).all()
    const members = this.db.select().from(customGroupMember).all()
    return groupings.map((grouping) => ({
      id: grouping.id,
      name: grouping.name,
      groups: groups
        .filter((g) => g.groupingId === grouping.id)
        .map((g) => ({ id: g.id, name: g.name })),
      members: members
        .filter((m) => m.groupingId === grouping.id)
        .map((m) => ({ instrumentId: m.instrumentId, groupId: m.groupId })),
    }))
  }

  get(id: string): GroupingDto {
    const found = this.list().find((g) => g.id === id)
    if (!found) throw new NotFoundException('Aufteilung nicht gefunden')
    return found
  }

  create(input: GroupingInput): GroupingDto {
    this.assertFreeName(input.name)
    const id = this.db.transaction((tx) => {
      const grouping = tx.insert(customGrouping).values({ name: input.name }).returning().get()
      tx.insert(customGroup)
        .values(input.groups.map((name, position) => ({ groupingId: grouping.id, name, position })))
        .run()
      return grouping.id
    })
    return this.get(id)
  }

  /** Renames; keeps groups with unchanged names (and their members), adds and removes the rest. */
  update(id: string, input: GroupingInput): GroupingDto {
    const current = this.get(id)
    this.assertFreeName(input.name, id)
    this.db.transaction((tx) => {
      tx.update(customGrouping).set({ name: input.name }).where(eq(customGrouping.id, id)).run()
      const removed = current.groups.filter((g) => !input.groups.includes(g.name)).map((g) => g.id)
      if (removed.length > 0) tx.delete(customGroup).where(inArray(customGroup.id, removed)).run()
      input.groups.forEach((name, position) => {
        const existing = current.groups.find((g) => g.name === name)
        if (existing) {
          tx.update(customGroup).set({ position }).where(eq(customGroup.id, existing.id)).run()
        } else {
          tx.insert(customGroup).values({ groupingId: id, name, position }).run()
        }
      })
    })
    return this.get(id)
  }

  remove(id: string): void {
    if (this.db.delete(customGrouping).where(eq(customGrouping.id, id)).run().changes === 0) {
      throw new NotFoundException('Aufteilung nicht gefunden')
    }
  }

  /** `groupId: null` removes the instrument from the grouping. */
  setMembers(id: string, input: GroupingMembersInput): GroupingDto {
    const grouping = this.get(id)
    const groupIds = new Set(grouping.groups.map((g) => g.id))
    const instrumentIds = input.members.map((m) => m.instrumentId)
    if (instrumentIds.length > 0) {
      const known = this.db
        .select({ id: instrument.id })
        .from(instrument)
        .where(inArray(instrument.id, instrumentIds))
        .all().length
      if (known !== new Set(instrumentIds).size)
        throw new BadRequestException('Wertpapier nicht gefunden')
    }
    for (const member of input.members) {
      if (member.groupId && !groupIds.has(member.groupId)) {
        throw new BadRequestException('Gruppe gehört nicht zu dieser Aufteilung')
      }
    }
    this.db.transaction((tx) => {
      for (const member of input.members) {
        tx.delete(customGroupMember)
          .where(
            and(
              eq(customGroupMember.groupingId, id),
              eq(customGroupMember.instrumentId, member.instrumentId),
            ),
          )
          .run()
        if (member.groupId) {
          tx.insert(customGroupMember)
            .values({ groupingId: id, groupId: member.groupId, instrumentId: member.instrumentId })
            .run()
        }
      }
    })
    return this.get(id)
  }

  inflation(): InflationRates {
    return this.db.select().from(inflationRate).orderBy(asc(inflationRate.year)).all()
  }

  setInflation(rates: InflationRates): InflationRates {
    this.db.transaction((tx) => {
      tx.delete(inflationRate).run()
      if (rates.length > 0) tx.insert(inflationRate).values(rates).run()
    })
    return this.inflation()
  }

  private assertFreeName(name: string, exceptId?: string): void {
    const existing = this.db
      .select({ id: customGrouping.id })
      .from(customGrouping)
      .where(eq(customGrouping.name, name))
      .get()
    if (existing && existing.id !== exceptId) {
      throw new ConflictException('Eine Aufteilung mit diesem Namen existiert bereits')
    }
  }
}
