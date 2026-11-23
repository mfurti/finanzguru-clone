import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Period, PositionColumn, PositionDto } from '@finance/shared'
import { and, asc, count, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { instrument, price, transaction } from '../../database/schema'
import { resolvePeriod, todayIso } from '../../domain/period'
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
    return { instrument: info, position, series, transactions }
  }

  transactions(query: {
    accounts?: string[]
    type?: string
    instrumentId?: string
    from?: string
    to?: string
    page: number
    pageSize: number
  }) {
    const depots = this.investments.depotIds(query.accounts)
    if (depots.length === 0) return { items: [], total: 0 }
    const where = and(
      inArray(transaction.accountId, depots),
      query.type ? eq(transaction.type, query.type as never) : undefined,
      query.instrumentId ? eq(transaction.instrumentId, query.instrumentId) : undefined,
      query.from ? gte(transaction.bookingDate, query.from) : undefined,
      query.to ? lte(transaction.bookingDate, query.to) : undefined,
    )
    const total = this.db.select({ n: count() }).from(transaction).where(where).get()?.n ?? 0
    const items = this.db
      .select({
        id: transaction.id,
        accountId: transaction.accountId,
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
      })
      .from(transaction)
      .leftJoin(instrument, eq(instrument.id, transaction.instrumentId))
      .where(where)
      .orderBy(desc(transaction.bookingDate), desc(transaction.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize)
      .all()
    return { items, total }
  }
}
