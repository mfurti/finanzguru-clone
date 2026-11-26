import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { AccountDto, CashflowSummary, TransactionListItem } from '@finance/shared'
import { eq, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { deletedImportMarker, tag, transaction, transactionTag } from '../../src/database/schema'
import {
  TransactionsTrashService,
  UNDO_WINDOW_MS,
} from '../../src/modules/transactions/transactions-trash.service'
import { createDemoApp } from '../helpers/demo-app'

describe('transactions undo store (research R2)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let db: AppDatabase
  let trash: TransactionsTrashService

  beforeAll(async () => {
    ;({ app, cookie } = await createDemoApp())
    db = app.get<AppDatabase>(DB)
    trash = app.get(TransactionsTrashService)
  })

  afterAll(async () => {
    await app?.close()
  })

  const get = async <T>(url: string) => {
    const res = await app.inject({ method: 'GET', url, headers: { cookie } })
    expect(res.statusCode).toBe(200)
    return res.json() as T
  }
  const october = () =>
    get<CashflowSummary>('/api/cashflow/summary?anchor=2026-10-15').then((s) => s.expenseCents)
  const balanceOf = async (accountId: string) =>
    (await get<AccountDto[]>('/api/accounts')).find((acc) => acc.id === accountId)!.balanceCents

  it('removes a booking from cashflow and balance and restores it with its tags', async () => {
    const list = await get<{ items: TransactionListItem[] }>(
      '/api/transactions?from=2026-10-01&to=2026-10-31&type=expense&pageSize=1',
    )
    const row = list.items[0]!
    const urlaub = db.insert(tag).values({ name: 'Urlaub' }).returning().get()
    db.insert(transactionTag).values({ transactionId: row.id, tagId: urlaub.id }).run()

    const expensesBefore = await october()
    const balanceBefore = await balanceOf(row.accountId)

    const { affected, undoToken } = trash.remove([row.id])
    expect(affected).toBe(1)
    expect(await october()).toBe(expensesBefore + row.amountCents)
    expect(await balanceOf(row.accountId)).toBe(balanceBefore - row.amountCents)

    expect(trash.restore(undoToken!)).toEqual({ restored: 1 })
    expect(await october()).toBe(expensesBefore)
    expect(await balanceOf(row.accountId)).toBe(balanceBefore)
    expect(
      db.select().from(transactionTag).where(eq(transactionTag.transactionId, row.id)).all(),
    ).toHaveLength(1)
  })

  it('marks imported bookings and removes the marker on restore', async () => {
    // The demo data is manual only; turn three bookings into CSV imports.
    const imported = db
      .select({ id: transaction.id })
      .from(transaction)
      .limit(3)
      .all()
      .map((row) => row.id)
    db.update(transaction).set({ source: 'csv' }).where(inArray(transaction.id, imported)).run()
    const { undoToken } = trash.remove(imported)
    expect(db.select().from(deletedImportMarker).all()).toHaveLength(3)
    trash.restore(undoToken!)
    expect(db.select().from(deletedImportMarker).all()).toHaveLength(0)
  })

  it('expires the undo token after 10 s', async () => {
    const list = await get<{ items: TransactionListItem[] }>('/api/transactions?pageSize=1')
    const now = Date.now()
    const { undoToken } = trash.remove([list.items[0]!.id], now)
    expect(() => trash.restore(undoToken!, now + UNDO_WINDOW_MS + 1)).toThrow(/nicht mehr/)
  })

  it('returns 0 for unknown ids', () => {
    expect(trash.remove(['nope'])).toEqual({ affected: 0 })
  })
})
