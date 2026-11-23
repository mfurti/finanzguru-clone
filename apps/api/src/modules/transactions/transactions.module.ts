import { Module } from '@nestjs/common'
import { OverviewModule } from '../overview/overview.module'
import { TransactionsController } from './transactions.controller'

@Module({
  imports: [OverviewModule],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
