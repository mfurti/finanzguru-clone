import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type {
  ExemptionOrderInput,
  TaxYearDto,
  TaxYearInput,
  VorabpauschaleResponse,
} from '@finance/shared'
import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import {
  account,
  exemptionOrder,
  institution,
  instrument,
  price,
  taxYear,
  transaction,
} from '../../database/schema'
import { allowanceCheck, orderUsage, taxableIncome } from '../../domain/exemption'
import { computePositions } from '../../domain/positions'
import { todayIso } from '../../domain/period'
import { vorabpauschale } from '../../domain/vorabpauschale'
import { OverviewService } from '../overview/overview.service'

type Tx = typeof transaction.$inferSelect

/** Steuern page (US4): exemption orders per broker and the Vorabpauschale estimate. */
@Injectable()
export class TaxesService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly overview: OverviewService,
  ) {}

  private settings(year: number) {
    return (
      this.db.select().from(taxYear).where(eq(taxYear.year, year)).get() ?? {
        year,
        assessment: 'single' as const,
        baseRate: null,
      }
    )
  }

  private transactionsUntil(accountIds: readonly string[], until: string): Tx[] {
    if (accountIds.length === 0) return []
    return this.db
      .select()
      .from(transaction)
      .where(
        and(inArray(transaction.accountId, [...accountIds]), lte(transaction.bookingDate, until)),
      )
      .orderBy(asc(transaction.bookingDate), asc(transaction.createdAt))
      .all()
  }

  /** Gross dividends + gross interest + realized gains − fee bookings of a broker in a year. */
  incomeOf(institutionId: string, year: number): number {
    const accountIds = this.db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.institutionId, institutionId))
      .all()
      .map((row) => row.id)
    const start = `${year}-01-01`
    const end = `${year}-12-31`
    const txs = this.transactionsUntil(accountIds, end)
    const inYear = txs.filter((tx) => tx.bookingDate >= start)
    const realized = (rows: Tx[]) =>
      [...computePositions(rows).values()].reduce((sum, s) => sum + s.realizedGrossCents, 0)
    return taxableIncome({
      dividendsGrossCents: inYear
        .filter((tx) => tx.type === 'dividend')
        .reduce((sum, tx) => sum + tx.amountCents + tx.taxCents, 0),
      interestGrossCents: inYear
        .filter((tx) => tx.type === 'interest')
        .reduce((sum, tx) => sum + tx.amountCents + tx.taxCents, 0),
      realizedGainsCents: realized(txs) - realized(txs.filter((tx) => tx.bookingDate < start)),
      feesCents: inYear
        .filter((tx) => tx.type === 'fee')
        .reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0),
    })
  }

  year(year: number): TaxYearDto {
    const settings = this.settings(year)
    const orders = this.db
      .select({
        id: exemptionOrder.id,
        institutionId: exemptionOrder.institutionId,
        institutionName: institution.name,
        amountCents: exemptionOrder.amountCents,
      })
      .from(exemptionOrder)
      .innerJoin(institution, eq(institution.id, exemptionOrder.institutionId))
      .where(eq(exemptionOrder.year, year))
      .orderBy(asc(institution.name))
      .all()
      .map((order) => {
        const income = this.incomeOf(order.institutionId, year)
        return { ...order, ...orderUsage(order.amountCents, income), taxableIncomeCents: income }
      })
    const check = allowanceCheck(
      settings.assessment,
      orders.map((o) => o.amountCents),
    )
    return {
      year,
      assessment: settings.assessment,
      baseRate: settings.baseRate,
      orders,
      usedCents: orders.reduce((sum, o) => sum + o.usedCents, 0),
      ...check,
    }
  }

  setYear(year: number, input: TaxYearInput): TaxYearDto {
    this.db
      .insert(taxYear)
      .values({ year, assessment: input.assessment, baseRate: input.baseRate ?? null })
      .onConflictDoUpdate({
        target: taxYear.year,
        set: { assessment: input.assessment, baseRate: input.baseRate ?? null },
      })
      .run()
    return this.year(year)
  }

  createOrder(year: number, input: ExemptionOrderInput): TaxYearDto {
    this.assertInstitution(input.institutionId)
    const exists = this.db
      .select({ id: exemptionOrder.id })
      .from(exemptionOrder)
      .where(
        and(eq(exemptionOrder.institutionId, input.institutionId), eq(exemptionOrder.year, year)),
      )
      .get()
    if (exists) throw new ConflictException('Für diesen Broker gibt es schon einen Auftrag')
    this.db
      .insert(exemptionOrder)
      .values({ ...input, year })
      .run()
    return this.year(year)
  }

  updateOrder(id: string, amountCents: number): TaxYearDto {
    const row = this.db
      .update(exemptionOrder)
      .set({ amountCents })
      .where(eq(exemptionOrder.id, id))
      .returning()
      .get()
    if (!row) throw new NotFoundException('Freistellungsauftrag nicht gefunden')
    return this.year(row.year)
  }

  removeOrder(id: string): void {
    if (this.db.delete(exemptionOrder).where(eq(exemptionOrder.id, id)).run().changes === 0) {
      throw new NotFoundException('Freistellungsauftrag nicht gefunden')
    }
  }

  /** Estimate per fund held at the end of the year (current year: as of today). */
  vorabpauschale(year: number, accounts?: string[], today = todayIso()): VorabpauschaleResponse {
    const { baseRate } = this.settings(year)
    const depots = this.overview.resolveAccounts(accounts).filter((a) => a.type === 'depot')
    const end = `${year}-12-31` < today ? `${year}-12-31` : today
    const start = `${year}-01-01`
    const funds = new Map(
      this.db
        .select()
        .from(instrument)
        .where(inArray(instrument.assetClass, ['etf', 'fund']))
        .all()
        .map((row) => [row.id, row]),
    )

    const brokers = new Map(
      depots.length === 0
        ? []
        : this.db
            .select({ id: account.id, broker: institution.name })
            .from(account)
            .innerJoin(institution, eq(institution.id, account.institutionId))
            .where(
              inArray(
                account.id,
                depots.map((d) => d.id),
              ),
            )
            .all()
            .map((row) => [row.id, row.broker]),
    )
    // Per depot, so a fund held at two brokers shows up under each (FR-017).
    const rows = depots
      .flatMap((depot) => {
        const txs = this.transactionsUntil([depot.id], end)
        return [...computePositions(txs).values()].map((state) => ({ state, txs, depot }))
      })
      .filter(({ state }) => funds.has(state.instrumentId) && state.lots.length > 0)
      .map(({ state, txs, depot }) => {
        const fund = funds.get(state.instrumentId)!
        const before = this.db
          .select({ close: price.close })
          .from(price)
          .where(and(eq(price.instrumentId, fund.id), lte(price.date, `${year - 1}-12-31`)))
          .orderBy(desc(price.date))
          .limit(1)
          .get()
        const first = this.db
          .select({ close: price.close })
          .from(price)
          .where(and(eq(price.instrumentId, fund.id), gte(price.date, start)))
          .orderBy(asc(price.date))
          .limit(1)
          .get()
        const last = this.db
          .select({ close: price.close })
          .from(price)
          .where(and(eq(price.instrumentId, fund.id), lte(price.date, end)))
          .orderBy(desc(price.date))
          .limit(1)
          .get()
        const distributionsCents = txs
          .filter(
            (tx) =>
              tx.instrumentId === fund.id && tx.type === 'dividend' && tx.bookingDate >= start,
          )
          .reduce((sum, tx) => sum + tx.amountCents + tx.taxCents, 0)
        const fundType = fund.fundType ?? 'equity'
        const result = vorabpauschale({
          year,
          baseRate,
          fundType,
          startPrice: before?.close ?? first?.close ?? null,
          endPrice: last?.close ?? null,
          lots: state.lots.map((lot) => ({
            quantity: lot.quantity.toString(),
            openDate: lot.openDate,
          })),
          distributionsCents,
        })
        return {
          instrumentId: fund.id,
          accountId: depot.id,
          broker: brokers.get(depot.id) ?? '',
          name: fund.name,
          fundType,
          ...result,
        }
      })
      .sort((a, b) => a.broker.localeCompare(b.broker) || a.name.localeCompare(b.name))
    const groups = [...new Set(rows.map((row) => row.broker))].map((broker) => {
      const own = rows.filter((row) => row.broker === broker)
      return {
        broker,
        rows: own,
        subtotalCents: own.reduce((sum, row) => sum + row.taxableCents, 0),
      }
    })

    return {
      year,
      baseRate,
      rows,
      brokers: groups,
      totalTaxableCents: rows.reduce((sum, row) => sum + row.taxableCents, 0),
      estimate: true,
    }
  }

  private assertInstitution(id: string): void {
    if (
      !this.db.select({ id: institution.id }).from(institution).where(eq(institution.id, id)).get()
    ) {
      throw new BadRequestException('Broker nicht gefunden')
    }
  }
}
