import { Module } from '@nestjs/common'
import { OverviewModule } from '../overview/overview.module'
import { CashflowController } from './cashflow.controller'
import { CashflowService } from './cashflow.service'

@Module({
  imports: [OverviewModule],
  controllers: [CashflowController],
  providers: [CashflowService],
  exports: [CashflowService],
})
export class CashflowModule {}
