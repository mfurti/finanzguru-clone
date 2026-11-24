import { Inject, Injectable } from '@nestjs/common'
import type { SearchHit, SearchResult } from '@finance/shared'
import { desc, eq, like, or, sql } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { account, institution, instrument, transaction } from '../../database/schema'

const LIMIT = 5

/** Static pages of the app with German names and a few synonyms. */
const PAGES: { label: string; to: string; words: string }[] = [
  { label: 'Dashboard', to: '/', words: 'übersicht start vermögen' },
  { label: 'Portfolios & Konten', to: '/accounts', words: 'konten depots portfolio' },
  { label: 'Transaktionen', to: '/transactions', words: 'buchungen umsätze prüfen ungeprüft' },
  { label: 'Investments', to: '/investments', words: 'positionen wertpapiere' },
  { label: 'Buchungen', to: '/investments/transactions', words: 'käufe verkäufe orders' },
  { label: 'Analyse', to: '/investments/analysis', words: 'aufteilung rendite regionen' },
  { label: 'Dividenden', to: '/investments/dividends', words: 'ausschüttungen kalender' },
  { label: 'Steuern', to: '/investments/taxes', words: 'freistellungsauftrag vorabpauschale' },
  { label: 'Watchlists', to: '/investments/watchlists', words: 'beobachten merkliste' },
  { label: 'Budget', to: '/budget', words: 'kategorien ausgaben einnahmen' },
  { label: 'Sankey', to: '/budget/sankey', words: 'geldfluss' },
  { label: 'Budgets', to: '/budget/budgets', words: 'limit' },
  { label: 'Versicherung', to: '/insurance', words: 'verträge policen' },
  { label: 'Datenquellen', to: '/settings/sources', words: 'einstellungen import csv' },
  { label: 'Kategorien', to: '/settings/categories', words: 'einstellungen regeln symbole' },
]

/**
 * Global search (003 US7, research R3): pages, securities, accounts and
 * bookings with plain LIKE queries, at most five hits per group. Runs only
 * on local data; nothing leaves the server (FR-025).
 */
@Injectable()
export class SearchService {
  constructor(@Inject(DB) private readonly db: AppDatabase) {}

  search(q: string): SearchResult {
    const term = q.trim().toLowerCase()
    const pattern = `%${term.replace(/[%_]/g, '')}%`
    const compact = `%${term.replace(/\s+/g, '').replace(/[%_]/g, '').toUpperCase()}%`

    const pages: SearchHit[] = PAGES.filter((page) =>
      `${page.label} ${page.words}`.toLowerCase().includes(term),
    )
      .slice(0, LIMIT)
      .map((page) => ({ id: page.to, label: page.label, to: page.to }))

    const instruments: SearchHit[] = this.db
      .select({
        id: instrument.id,
        name: instrument.name,
        isin: instrument.isin,
        wkn: instrument.wkn,
      })
      .from(instrument)
      .where(
        or(
          like(sql`lower(${instrument.name})`, pattern),
          like(instrument.isin, compact),
          like(instrument.wkn, compact),
        ),
      )
      .limit(LIMIT)
      .all()
      .map((row) => ({
        id: row.id,
        label: row.name,
        sub: [row.wkn, row.isin].filter(Boolean).join(' · '),
        to: `/investments/${row.id}`,
      }))

    const accounts: SearchHit[] = this.db
      .select({
        id: account.id,
        name: account.name,
        type: account.type,
        institution: institution.name,
      })
      .from(account)
      .innerJoin(institution, eq(institution.id, account.institutionId))
      .where(
        or(
          like(sql`lower(${account.name})`, pattern),
          like(sql`lower(${institution.name})`, pattern),
          like(account.iban, compact),
        ),
      )
      .limit(LIMIT)
      .all()
      .map((row) => ({
        id: row.id,
        label: row.name,
        sub: row.institution,
        to: `/${row.type === 'depot' ? 'depots' : 'accounts'}/${row.id}`,
      }))

    const transactions: SearchHit[] = this.db
      .select({
        id: transaction.id,
        counterparty: transaction.counterparty,
        purpose: transaction.purpose,
        date: transaction.bookingDate,
      })
      .from(transaction)
      .where(
        or(
          like(sql`lower(${transaction.counterparty})`, pattern),
          like(sql`lower(${transaction.purpose})`, pattern),
        ),
      )
      .orderBy(desc(transaction.bookingDate))
      .limit(LIMIT)
      .all()
      .map((row) => ({
        id: row.id,
        label: row.counterparty ?? row.purpose ?? '',
        sub: row.date,
        to: `/transactions?q=${encodeURIComponent(q.trim())}`,
      }))

    return { pages, instruments, accounts, transactions }
  }
}
