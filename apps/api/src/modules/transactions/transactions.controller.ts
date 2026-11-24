import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  createTransactionInput,
  restoreInput,
  transactionBulkInput,
  type TransactionBulkResult,
  type TransactionDto,
  transactionFilter,
  transactionListQuery,
  type TransactionPage,
  updateTransactionInput,
} from '@finance/shared'
import { count, eq } from 'drizzle-orm'
import { createZodDto } from 'nestjs-zod'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { category, transaction } from '../../database/schema'
import { OverviewService } from '../overview/overview.service'
import { TransactionsBulkService } from './transactions-bulk.service'
import { TransactionsReviewService } from './transactions-review.service'
import { TransactionsTrashService } from './transactions-trash.service'
import { TransactionsWriteService } from './transactions-write.service'

class FilterQueryDto extends createZodDto(transactionFilter) {}
class BulkDto extends createZodDto(transactionBulkInput) {}
class RestoreDto extends createZodDto(restoreInput) {}
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
    private readonly bulkActions: TransactionsBulkService,
    private readonly trash: TransactionsTrashService,
  ) {}

  /** Bulk category/tags/reviewed/delete on ids or a filter (FR-005). */
  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  bulk(@Body() body: BulkDto): TransactionBulkResult {
    return this.bulkActions.run(body)
  }

  /** Undo a delete within 10 s; 410 afterwards. */
  @Post('restore')
  @HttpCode(HttpStatus.OK)
  restore(@Body() body: RestoreDto): { restored: number } {
    return this.trash.restore(body.undoToken)
  }

  @Delete(':id')
  remove(@Param('id') id: string): { undoToken: string } {
    const result = this.trash.remove([id])
    if (!result.undoToken) throw new NotFoundException('Transaktion nicht gefunden')
    return { undoToken: result.undoToken }
  }

  @Get()
  list(@Query() query: TransactionListQueryDto): TransactionPage {
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

  /** "Ungeprüfte Transaktionen": unreviewed bookings matching the filter (review is forced). */
  @Get('unreviewed/count')
  unreviewedCount(@Query() query: FilterQueryDto): { count: number } {
    const where = this.review.whereFor({ ...query, review: 'unreviewed', status: undefined })
    if (where === null) return { count: 0 }
    const row = this.db
      .select({ count: count() })
      .from(transaction)
      .leftJoin(category, eq(category.id, transaction.categoryId))
      .where(where)
      .get()
    return { count: row?.count ?? 0 }
  }
}
