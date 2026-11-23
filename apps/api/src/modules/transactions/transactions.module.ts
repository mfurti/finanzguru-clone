import { Module } from '@nestjs/common'
import { ImportModule } from '../import/import.module'
import { OverviewModule } from '../overview/overview.module'
import { TransactionsReviewService } from './transactions-review.service'
import { TransactionsWriteService } from './transactions-write.service'
import { TransactionsController } from './transactions.controller'

@Module({
  imports: [OverviewModule, ImportModule],
  providers: [TransactionsWriteService, TransactionsReviewService],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
