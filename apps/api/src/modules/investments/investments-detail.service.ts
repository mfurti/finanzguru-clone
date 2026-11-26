import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type {
  GainSplit,
  InvestmentTransactionRow,
  InvestmentTransactionsQuery,
  InvestmentTransactionsResponse,
  Period,
  PositionColumn,
  PositionDto,
  TransactionColumn,
} from '@finance/shared'
import { and, asc, count, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { account, instrument, price, transaction } from '../../database/schema'
import { resolvePeriod, todayIso } from '../../domain/period'
import { computePositions, gainSplit, summarize } from '../../domain/positions'
import { downsample } from '../overview/overview.service'
import { InvestmentsService } from './investments.service'

const HEADERS: Record<PositionColumn, string> = {
  name: 'Name',
  assetClass: 'Typ',
  wkn: 'WKN',
  isin: 'ISIN',
  price: 'Aktueller Kurs',
  dayChange: 'Tagesänderung %',
  quantity: 'Stück',
  value: 'Aktueller Wert',
  entryValue: 'Einstiegswert',
  avgPrice: 'Ø Kaufkurs',
  gain: 'Kursgewinn',
  gainPct: 'Kursgewinn %',
  allocation: 'Allokation %',
  dividends: 'Dividende',
}

const decimal = (value: number | string | null, digits = 2): string =>
  value === null || value === ''
    ? ''
    : Number(value).toLocaleString('de-DE', {
        minimumFractionDigits: digits,
        maximumFractionDigits: Math.max(digits, 6),
        useGrouping: false,
      })
const euros = (cents: number) => decimal(cents / 100)
const pct = (ratio: string | null) => (ratio === null ? '' : decimal(Number(ratio) * 100))

function cellOf(row: PositionDto, column: PositionColumn): string {
  switch (column) {
    case 'name':
      return row.name
    case 'assetClass':
      return row.assetClass
    case 'wkn':
      return row.wkn ?? ''
    case 'isin':
      return row.isin
    case 'price':
      return euros(row.priceCents)
    case 'dayChange':
      return pct(row.dayChangePct)
    case 'quantity':
      return decimal(row.quantity, 0)
    case 'value':
      return euros(row.valueCents)
    case 'entryValue':
      return euros(row.entryValueCents)
    case 'avgPrice':
      return decimal(row.avgPrice)
    case 'gain':
      return euros(row.gainCents)
    case 'gainPct':
      return pct(row.gainPct)
    case 'allocation':
      return pct(row.allocationPct)
    case 'dividends':
      return euros(row.dividendsCents)
  }
}

/** `;`-separated, quoted where needed, de-DE decimals, UTF-8 BOM for Excel. */
export function positionsToCsv(
  rows: readonly PositionDto[],
  columns: readonly PositionColumn[],
): string {
  const quote = (value: string) =>
    /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  const lines = [
    columns.map((column) => quote(HEADERS[column])).join(';'),
    ...rows.map((row) => columns.map((column) => quote(cellOf(row, column))).join(';')),
  ]
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

const TRANSACTION_HEADERS: Record<TransactionColumn, string> = {
  date: 'Datum',
  type: 'Typ',
  name: 'Name',
  wkn: 'WKN',
  isin: 'ISIN',
  account: 'Depot',
  unitPrice: 'Kaufpreis/Stück',
  quantity: 'Stück',
  tax: 'Steuern',
  fee: 'Gebühren',
  amount: 'Gesamtbetrag',
}

const TYPE_LABELS: Record<string, string> = {
  buy: 'Kauf',
  sell: 'Verkauf',
  dividend: 'Dividende',
  interest: 'Zinsen',
  tax: 'Steuer',
  fee: 'Gebühr',
  split: 'Split',
  deposit: 'Einzahlung',
  withdrawal: 'Auszahlung',
}

/** Text cells starting with = + - @ would run as formulas in spreadsheets. */
const safeText = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value)

function transactionCell(row: InvestmentTransactionRow, column: TransactionColumn): string {
  switch (column) {
    case 'date':
      return row.bookingDate.split('-').reverse().join('.')
    case 'type':
      return TYPE_LABELS[row.type] ?? row.type
    case 'name':
      return safeText(row.instrumentName ?? '')
    case 'wkn':
      return row.wkn ?? ''
    case 'isin':
      return row.isin ?? ''
    case 'account':
      return safeText(row.accountName)
    case 'unitPrice':
      return row.unitPrice === null ? '' : decimal(row.unitPrice)
    case 'quantity':
      return row.quantity === null ? '' : decimal(row.quantity, 0)
    case 'tax':
      return euros(row.taxCents)
    case 'fee':
      return euros(row.feeCents)
    case 'amount':
      return euros(row.amountCents)
  }
}

/** Bookings CSV: same format as the positions export. */
export function transactionsToCsv(
  rows: readonly InvestmentTransactionRow[],
  columns: readonly TransactionColumn[],
): string {
  const quote = (value: string) =>
    /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  const lines = [
    columns.map((column) => quote(TRANSACTION_HEADERS[column])).join(';'),
    ...rows.map((row) => columns.map((column) => quote(transactionCell(row, column))).join(';')),
  ]
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

@Injectable()
export class InvestmentsDetailService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly investments: InvestmentsService,
  ) {}

  instrument(id: string, query: { accounts?: string[]; period: Period }, today = todayIso()) {
    const info = this.db.select().from(instrument).where(eq(instrument.id, id)).get()
    if (!info) throw new NotFoundException('Wertpapier nicht gefunden')
    const depots = this.investments.depotIds(query.accounts)
    const position =
      this.investments
        .positions({ accounts: query.accounts, status: 'open' })
        .find((row) => row.instrumentId === id) ??
      this.investments
        .positions({ accounts: query.accounts, status: 'sold' })
        .find((row) => row.instrumentId === id) ??
      null
    const first = this.db
      .select({ date: price.date })
      .from(price)
      .where(eq(price.instrumentId, id))
      .orderBy(asc(price.date))
      .limit(1)
      .get()?.date
    const range = resolvePeriod(query.period, today, first)
    const series = downsample(
      this.db
        .select({ date: price.date, close: price.close })
        .from(price)
        .where(
          and(eq(price.instrumentId, id), gte(price.date, range.from), lte(price.date, range.to)),
        )
        .orderBy(asc(price.date))
        .all(),
    )
    const transactions =
      depots.length === 0
        ? []
        : this.db
            .select()
            .from(transaction)
            .where(and(inArray(transaction.accountId, depots), eq(transaction.instrumentId, id)))
            .orderBy(desc(transaction.bookingDate))
            .all()
    return {
      instrument: info,
      position,
      series,
      transactions,
      gain: this.gain(id, transactions, position),
    }
  }

  /**
   * GuV = Realisiert + Kursgewinn (005 US3). FIFO runs per depot, so a sale only consumes lots
   * of its own depot; the price gain uses the current value of the open position.
   */
  private gain(
    id: string,
    transactions: (typeof transaction.$inferSelect)[],
    position: { valueCents: number; quantity: string } | null,
  ): GainSplit {
    const byDepot = new Map<string, (typeof transaction.$inferSelect)[]>()
    for (const tx of transactions) {
      byDepot.set(tx.accountId, [...(byDepot.get(tx.accountId) ?? []), tx])
    }
    let realizedCents = 0
    let investedCents = 0
    for (const txs of byDepot.values()) {
      const state = computePositions(txs).get(id)
      if (!state) continue
      realizedCents += gainSplit(state, 0).realizedCents
      investedCents += summarize(state).investedCents
    }
    const open = position && Number(position.quantity) > 0 ? position.valueCents : 0
    const priceGainCents = open > 0 ? open - investedCents : 0
    return { totalGainCents: realizedCents + priceGainCents, realizedCents, priceGainCents }
  }

  /** Bookings of the selected depots, filtered and sorted; `sumCents` covers all filtered rows. */
  transactions(
    query: Omit<InvestmentTransactionsQuery, 'page' | 'pageSize'> & {
      page?: number
      pageSize?: number
    },
  ): InvestmentTransactionsResponse {
    const depots = this.investments.depotIds(query.accounts)
    if (depots.length === 0) return { items: [], total: 0, sumCents: 0 }
    const where = and(
      inArray(transaction.accountId, depots),
      query.type ? eq(transaction.type, query.type) : undefined,
      query.types && query.types.length > 0
        ? inArray(transaction.type, query.types as (typeof transaction.type._.data)[])
        : undefined,
      query.minCents !== undefined ? gte(transaction.amountCents, query.minCents) : undefined,
      query.maxCents !== undefined ? lte(transaction.amountCents, query.maxCents) : undefined,
      query.instrumentId ? eq(transaction.instrumentId, query.instrumentId) : undefined,
      query.from ? gte(transaction.bookingDate, query.from) : undefined,
      query.to ? lte(transaction.bookingDate, query.to) : undefined,
    )
    const totals = this.db
      .select({ n: count(), sum: sql<number>`coalesce(sum(${transaction.amountCents}), 0)` })
      .from(transaction)
      .where(where)
      .get()
    const order = query.dir === 'asc' ? asc : desc
    const column = {
      date: transaction.bookingDate,
      amount: transaction.amountCents,
      type: transaction.type,
      name: sql`lower(coalesce(${instrument.name}, ''))`,
      account: sql`lower(${account.name})`,
      unitPrice: sql`cast(${transaction.unitPrice} as real)`,
      quantity: sql`cast(${transaction.quantity} as real)`,
      tax: transaction.taxCents,
      fee: transaction.feeCents,
    }[query.sort]
    const primary = order(column)
    let rows = this.db
      .select({
        id: transaction.id,
        accountId: transaction.accountId,
        accountName: account.name,
        bookingDate: transaction.bookingDate,
        type: transaction.type,
        amountCents: transaction.amountCents,
        quantity: transaction.quantity,
        unitPrice: transaction.unitPrice,
        feeCents: transaction.feeCents,
        taxCents: transaction.taxCents,
        instrumentId: transaction.instrumentId,
        instrumentName: instrument.name,
        isin: instrument.isin,
        wkn: instrument.wkn,
      })
      .from(transaction)
      .innerJoin(account, eq(account.id, transaction.accountId))
      .leftJoin(instrument, eq(instrument.id, transaction.instrumentId))
      .where(where)
      .orderBy(primary, order(transaction.createdAt))
      .$dynamic()
    if (query.pageSize) {
      rows = rows.limit(query.pageSize).offset(((query.page ?? 1) - 1) * query.pageSize)
    }
    return { items: rows.all(), total: totals?.n ?? 0, sumCents: Number(totals?.sum ?? 0) }
  }
}
