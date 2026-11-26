import { Module } from '@nestjs/common'
import { ImportModule } from '../import/import.module'
import { LogosModule } from '../logos/logos.module'
import { OverviewModule } from '../overview/overview.module'
import { TransactionsBulkService } from './transactions-bulk.service'
import { TransactionsReviewService } from './transactions-review.service'
import { TransactionsTrashService } from './transactions-trash.service'
import { TransactionsWriteService } from './transactions-write.service'
import { TransactionsController } from './transactions.controller'

@Module({
  imports: [OverviewModule, ImportModule, LogosModule],
  providers: [
    TransactionsWriteService,
    TransactionsReviewService,
    TransactionsTrashService,
    TransactionsBulkService,
  ],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
