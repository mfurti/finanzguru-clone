import { Inject, Injectable } from '@nestjs/common'
import type { FetchInput, SourceStatus } from '@finance/shared'
import { eq } from 'drizzle-orm'
import { DB } from '../../../database/database.constants'
import type { AppDatabase } from '../../../database/drizzle.module'
import { dataSource } from '../../../database/schema'
import { addDays } from '../../../domain/period'
import type { DataSource, SyncBatch } from '../data-source.interface'
import { AuthExpiredError } from '../errors'
import type { BankTransaction } from './client'
import { BANK_SOURCE_ID, EnableBankingConnectionService } from './enable-banking-connection.service'
import { mapBankData, type BankAccountData } from './mapper'

/** History read on the first sync (PSD2 banks usually allow 90 days without a new login). */
export const FIRST_SYNC_DAYS = 90
/** Overlap with the last sync, so late-booked entries are not missed (R2). */
export const OVERLAP_DAYS = 7
/** Safety limit for transaction pages per account. */
const MAX_PAGES = 100

/**
 * The owner's bank as a pull source (005 T012): details, balances and booked transactions of
 * every approved account through the read-only Enable Banking client, mapped to a SyncBatch.
 * An ended consent raises {@link AuthExpiredError}; the sync service then stops further syncs.
 */
@Injectable()
export class EnableBankingSource implements DataSource {
  readonly kind = 'enable_banking' as const

  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly connection: EnableBankingConnectionService,
  ) {}

  async status(): Promise<SourceStatus> {
    const row = this.db
      .select({ status: dataSource.status })
      .from(dataSource)
      .where(eq(dataSource.id, BANK_SOURCE_ID))
      .get()
    return row?.status ?? 'disabled'
  }

  async fetch(input: FetchInput): Promise<SyncBatch> {
    const session = this.connection.session()
    const consent = this.connection.consent()
    if (!session || !consent) throw new AuthExpiredError('Bank ist nicht verbunden')
    if (new Date(consent.validUntil).getTime() <= Date.now()) {
      throw new AuthExpiredError('Bankzugang abgelaufen')
    }
    const today = new Date().toISOString().slice(0, 10)
    const since = input.kind === 'pull' ? input.since : undefined
    const dateFrom = since
      ? addDays(since.slice(0, 10), -OVERLAP_DAYS)
      : addDays(today, -FIRST_SYNC_DAYS)
    const client = this.connection.client()
    const accounts: BankAccountData[] = []
    for (const uid of session.accountUids) {
      const details = await client.accountDetails(uid)
      const { balances } = await client.balances(uid)
      const transactions: BankTransaction[] = []
      let continuationKey: string | null | undefined
      for (let page = 0; page < MAX_PAGES; page++) {
        const result = await client.transactions(uid, { dateFrom, continuationKey })
        transactions.push(...result.transactions)
        continuationKey = result.continuation_key
        if (!continuationKey) break
      }
      accounts.push({ uid, details, balances, transactions })
    }
    return mapBankData({ institution: consent.aspspName, accounts })
  }
}
