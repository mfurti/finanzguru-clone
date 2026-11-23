import { Module } from '@nestjs/common'
import { ImportModule } from '../import/import.module'
import { OverviewModule } from '../overview/overview.module'
import { TransactionsWriteService } from './transactions-write.service'
import { TransactionsController } from './transactions.controller'

@Module({
  imports: [OverviewModule, ImportModule],
  providers: [TransactionsWriteService],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
