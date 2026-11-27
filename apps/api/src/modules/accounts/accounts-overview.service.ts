import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { AccountDetail, AccountOverviewRow, AccountsOverview, Period } from '@finance/shared'
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { account, dataSource, importJob, institution, transaction } from '../../database/schema'
import { addDays, todayIso } from '../../domain/period'
import { initials, maskIban, sparkline } from '../../domain/sparkline'
import { OverviewService } from '../overview/overview.service'
import { SyncService } from '../sources/sync.service'

/** Source kinds that can refresh themselves ("Aktualisieren"); CSV accounts only show the last import. */
const SYNC_KINDS = new Set(['scalable_mcp', 'enable_banking'])

/**
 * Übersicht › Portfolios & Konten (003 US2, research R6): one group per kind
 * with rows carrying avatar initials, masked IBAN, 30-day sparkline, last
 * sync/import and balance; plus the detail page of one account or depot.
 */
@Injectable()
export class AccountsOverviewService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly overview: OverviewService,
    private readonly syncService: SyncService,
  ) {}

  overviewGroups(accountIds?: readonly string[], today = todayIso()): AccountsOverview {
    const selected = new Set(this.overview.resolveAccounts(accountIds).map((acc) => acc.id))
    const rows = this.baseRows().filter((row) => selected.has(row.id))
    const built = rows.map((row) => this.toRow(row, today))
    const group = (kind: 'depot' | 'account') => {
      const items = built.filter((row) => (row.type === 'depot') === (kind === 'depot'))
      return {
        kind,
        totalCents: items.reduce((sum, row) => sum + row.balanceCents, 0),
        rows: items,
      }
    }
    return { groups: [group('depot'), group('account')].filter((g) => g.rows.length > 0) }
  }

  detail(
    id: string,
    query: { period: Period; from?: string; to?: string },
    today = todayIso(),
  ): AccountDetail {
    const row = this.baseRows().find((item) => item.id === id)
    if (!row) throw new NotFoundException('Konto nicht gefunden')
    const ref = [{ id: row.id, type: row.type }]
    const range = this.overview.range(ref, query, today)
    const history = this.overview
      .dailyTotals(ref, range)
      .map((point) => ({ date: point.date, valueCents: point.valueCents }))
    const flows = this.db
      .select({
        inflow: sql<number>`coalesce(sum(case when ${transaction.amountCents} > 0 then ${transaction.amountCents} end), 0)`,
        outflow: sql<number>`coalesce(sum(case when ${transaction.amountCents} < 0 then ${transaction.amountCents} end), 0)`,
      })
      .from(transaction)
      .where(
        and(
          eq(transaction.accountId, id),
          gte(transaction.bookingDate, range.from),
          lte(transaction.bookingDate, range.to),
        ),
      )
      .get()
    const built = this.toRow(row, today)
    const first = history[0]?.valueCents ?? built.balanceCents
    const last = history.at(-1)?.valueCents ?? built.balanceCents
    return {
      account: built,
      history,
      figures: {
        balanceCents: built.balanceCents,
        changeCents: last - first,
        inflowCents: Number(flows?.inflow ?? 0),
        outflowCents: Number(flows?.outflow ?? 0),
      },
    }
  }

  /** "Aktualisieren": starts the source sync (004 T010); CSV accounts get 409. */
  sync(id: string): { runId: string } {
    const row = this.baseRows().find((item) => item.id === id)
    if (!row) throw new NotFoundException('Konto nicht gefunden')
    if (!this.canSync(row) || !row.sourceId) {
      throw new ConflictException('Dieses Konto wird per Import aktualisiert')
    }
    return { runId: this.syncService.start(row.sourceId).runId }
  }

  private baseRows() {
    return this.db
      .select({
        id: account.id,
        name: account.name,
        type: account.type,
        iban: account.iban,
        institution: institution.name,
        isHidden: account.isHidden,
        lastSyncedAt: account.lastSyncedAt,
        sourceBalanceCents: account.sourceBalanceCents,
        sourceBalanceDate: account.sourceBalanceDate,
        balanceDiffCents: account.balanceDiffCents,
        sourceId: dataSource.id,
        sourceKind: dataSource.kind,
        sourceStatus: dataSource.status,
        sourceSyncAt: dataSource.lastSyncAt,
        sortOrder: account.sortOrder,
      })
      .from(account)
      .innerJoin(institution, eq(institution.id, account.institutionId))
      .leftJoin(dataSource, eq(dataSource.id, account.sourceId))
      .orderBy(account.sortOrder, account.name)
      .all()
  }

  /** Active connection of a pull source that is actually registered (sync would run). */
  private canSync(row: {
    sourceId: string | null
    sourceKind: string | null
    sourceStatus: string | null
  }): boolean {
    return (
      !!row.sourceId &&
      !!row.sourceKind &&
      SYNC_KINDS.has(row.sourceKind) &&
      row.sourceStatus === 'active' &&
      this.syncService.canSync(row.sourceId)
    )
  }

  private toRow(row: ReturnType<AccountsOverviewService['baseRows']>[number], today: string) {
    const ref = [{ id: row.id, type: row.type }]
    const series = this.overview
      .dailyTotals(ref, { from: addDays(today, -29), to: today })
      .map((point) => point.valueCents)
    const canSync = this.canSync(row)
    const syncedAt = row.lastSyncedAt ?? row.sourceSyncAt
    const lastImport = this.lastImports([row.id]).get(row.id) ?? null
    const lastUpdate: Pick<AccountOverviewRow, 'lastUpdateAt' | 'lastUpdateKind'> =
      canSync && syncedAt
        ? { lastUpdateAt: syncedAt, lastUpdateKind: 'sync' }
        : lastImport
          ? { lastUpdateAt: lastImport, lastUpdateKind: 'import' }
          : { lastUpdateAt: null, lastUpdateKind: null }
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      institution: row.institution,
      initials: initials(row.institution === 'Manuell' ? row.name : row.institution),
      ibanMasked: maskIban(row.iban),
      iban: row.iban,
      sparkline: sparkline(series),
      ...lastUpdate,
      canSync,
      balanceCents: series.at(-1) ?? 0,
      balanceCheck:
        row.balanceDiffCents !== null &&
        row.sourceBalanceCents !== null &&
        row.sourceBalanceDate !== null
          ? {
              sourceCents: row.sourceBalanceCents,
              at: row.sourceBalanceDate,
              differenceCents: row.balanceDiffCents,
            }
          : null,
    } satisfies AccountOverviewRow
  }

  private lastImports(accountIds: string[]): Map<string, string> {
    const rows = this.db
      .select({ accountId: importJob.accountId, at: importJob.finishedAt })
      .from(importJob)
      .where(
        and(
          inArray(importJob.accountId, accountIds),
          inArray(importJob.status, ['succeeded', 'partial']),
        ),
      )
      .orderBy(desc(importJob.finishedAt))
      .all()
    const result = new Map<string, string>()
    for (const row of rows) {
      if (row.accountId && row.at && !result.has(row.accountId)) result.set(row.accountId, row.at)
    }
    return result
  }
}
