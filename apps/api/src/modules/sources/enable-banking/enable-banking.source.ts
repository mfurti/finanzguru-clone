import { Inject, Injectable } from '@nestjs/common'
import type { FetchInput, SourceStatus } from '@finance/shared'
import { eq } from 'drizzle-orm'
import { DB } from '../../../database/database.constants'
import type { AppDatabase } from '../../../database/drizzle.module'
import { dataSource } from '../../../database/schema'
import { addDays } from '../../../domain/period'
import type { DataSource, SyncBatch } from '../data-source.interface'
import { AuthExpiredError, UpstreamError } from '../errors'
import { type BankTransaction, RATE_LIMIT_MESSAGE } from './client'
import { BANK_SOURCE_ID, EnableBankingConnectionService } from './enable-banking-connection.service'
import { mapBankData, type BankAccountData } from './mapper'

/** History read on the first sync (PSD2 banks usually allow 90 days without a new login). */
export const FIRST_SYNC_DAYS = 90
/** Furthest back asked for right after a bank login; the bank may return less (005 T035). */
export const LONG_HISTORY_DAYS = 730
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
    // Right after a bank login the bank may give more than 90 days: ask for the longest history.
    const longest = session.historyPending
    const dateFrom = longest
      ? addDays(today, -LONG_HISTORY_DAYS)
      : since
        ? addDays(since.slice(0, 10), -OVERLAP_DAYS)
        : addDays(today, -FIRST_SYNC_DAYS)
    const client = this.connection.client()
    const accounts: BankAccountData[] = []
    for (const uid of session.accountUids) {
      const details = await client.accountDetails(uid)
      const { balances } = await client.balances(uid)
      const read = async (from: string, long: boolean) => {
        const transactions: BankTransaction[] = []
        let continuationKey: string | null | undefined
        for (let page = 0; page < MAX_PAGES; page++) {
          const result = await client.transactions(uid, {
            dateFrom: from,
            continuationKey,
            longest: long,
          })
          transactions.push(...result.transactions)
          continuationKey = result.continuation_key
          if (!continuationKey) break
        }
        return transactions
      }
      let transactions: BankTransaction[]
      try {
        transactions = await read(dateFrom, longest)
      } catch (error) {
        // A bank that refuses the long history still gives the usual 90 days.
        if (!longest || !(error instanceof UpstreamError) || error.message === RATE_LIMIT_MESSAGE) {
          throw error
        }
        transactions = await read(addDays(today, -FIRST_SYNC_DAYS), false)
      }
      accounts.push({ uid, details, balances, transactions })
    }
    if (longest) this.connection.historyDone()
    return mapBankData({ institution: consent.aspspName, accounts })
  }
}
