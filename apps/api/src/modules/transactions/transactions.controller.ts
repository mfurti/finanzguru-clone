import { Controller, Get, Inject, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { accountsParam } from '@finance/shared'
import { and, count, eq, inArray, isNull } from 'drizzle-orm'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { transaction } from '../../database/schema'
import { OverviewService } from '../overview/overview.service'

class AccountsQueryDto extends createZodDto(z.object({ accounts: accountsParam })) {}

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly overview: OverviewService,
  ) {}

  /** "Ungeprüfte Transaktionen": unreviewed and without category. */
  @Get('unreviewed/count')
  unreviewedCount(@Query() query: AccountsQueryDto): { count: number } {
    const ids = this.overview.resolveAccounts(query.accounts).map((acc) => acc.id)
    if (ids.length === 0) return { count: 0 }
    const row = this.db
      .select({ count: count() })
      .from(transaction)
      .where(
        and(
          inArray(transaction.accountId, ids),
          eq(transaction.reviewStatus, 'unreviewed'),
          isNull(transaction.categoryId),
        ),
      )
      .get()
    return { count: row?.count ?? 0 }
  }
}
