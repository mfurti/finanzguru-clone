import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  accountsParam,
  createTransactionInput,
  type TransactionDto,
  type TransactionListItem,
  transactionListQuery,
  updateTransactionInput,
} from '@finance/shared'
import { and, count, eq, inArray, isNull } from 'drizzle-orm'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { transaction } from '../../database/schema'
import { OverviewService } from '../overview/overview.service'
import { TransactionsReviewService } from './transactions-review.service'
import { TransactionsWriteService } from './transactions-write.service'

class AccountsQueryDto extends createZodDto(z.object({ accounts: accountsParam })) {}
class CreateTransactionDto extends createZodDto(createTransactionInput) {}
class TransactionListQueryDto extends createZodDto(transactionListQuery) {}
class UpdateTransactionDto extends createZodDto(updateTransactionInput) {}

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly overview: OverviewService,
    private readonly writer: TransactionsWriteService,
    private readonly review: TransactionsReviewService,
  ) {}

  @Get()
  list(@Query() query: TransactionListQueryDto): { items: TransactionListItem[]; total: number } {
    return this.review.list(query)
  }

  /** Categorize / review; optional rule creation (US5). */
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateTransactionDto): { updated: number } {
    return this.review.update(id, body)
  }

  /** Manual transaction (FR-056). */
  @Post()
  create(@Body() body: CreateTransactionDto): TransactionDto {
    return this.writer.create(body)
  }

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
