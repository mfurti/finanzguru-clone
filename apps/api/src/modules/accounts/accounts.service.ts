import { Inject, Injectable } from '@nestjs/common'
import type { AccountDto, AccountTree, AccountTreeItem } from '@finance/shared'
import { asc, eq } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { account, institution } from '../../database/schema'
import { todayIso } from '../../domain/period'
import { OverviewService } from '../overview/overview.service'

@Injectable()
export class AccountsService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly overview: OverviewService,
  ) {}

  list(): AccountDto[] {
    return this.db
      .select({
        id: account.id,
        institutionId: account.institutionId,
        institutionName: institution.name,
        name: account.name,
        type: account.type,
        iban: account.iban,
        parentAccountId: account.parentAccountId,
        balanceCents: account.balanceCents,
        isHidden: account.isHidden,
        sortOrder: account.sortOrder,
        lastSyncedAt: account.lastSyncedAt,
      })
      .from(account)
      .innerJoin(institution, eq(institution.id, account.institutionId))
      .orderBy(asc(account.sortOrder), asc(account.name))
      .all()
  }

  /** Current value per account: latest snapshot (depot market value, cash balance). */
  currentValues(accountIds: readonly string[], today = todayIso()): Map<string, number> {
    const values = new Map<string, number>()
    for (const id of accountIds) {
      const totals = this.overview.dailyTotals([{ id, type: 'any' }], { from: today, to: today })
      values.set(id, totals.at(-1)?.valueCents ?? 0)
    }
    return values
  }

  /** Depots (with their reference accounts as children) and other accounts, with subtotals. */
  tree(accountIds?: readonly string[]): AccountTree {
    const selected = new Set(this.overview.resolveAccounts(accountIds).map((acc) => acc.id))
    const accounts = this.list().filter((acc) => selected.has(acc.id))
    const values = this.currentValues(accounts.map((acc) => acc.id))

    const toItem = (acc: AccountDto): AccountTreeItem => ({
      id: acc.id,
      name: acc.name,
      institution: acc.institutionName,
      logoKey: null,
      valueCents: values.get(acc.id) ?? 0,
    })

    const depots = accounts.filter((acc) => acc.type === 'depot')
    const depotIds = new Set(depots.map((acc) => acc.id))
    const children = (parentId: string) =>
      accounts.filter((acc) => acc.parentAccountId === parentId).map(toItem)

    const depotItems = depots.map((depot) => {
      const item = toItem(depot)
      const kids = children(depot.id)
      // A depot's total includes its reference account.
      return {
        ...item,
        valueCents: item.valueCents + kids.reduce((sum, kid) => sum + kid.valueCents, 0),
        children: kids,
      }
    })
    const otherItems = accounts
      .filter(
        (acc) =>
          acc.type !== 'depot' && !(acc.parentAccountId && depotIds.has(acc.parentAccountId)),
      )
      .map(toItem)

    const sum = (items: AccountTreeItem[]) =>
      items.reduce((total, item) => total + item.valueCents, 0)
    const groups: AccountTree['groups'] = []
    if (depotItems.length > 0)
      groups.push({ type: 'depots', totalCents: sum(depotItems), items: depotItems })
    if (otherItems.length > 0)
      groups.push({ type: 'accounts', totalCents: sum(otherItems), items: otherItems })
    return { groups }
  }
}
