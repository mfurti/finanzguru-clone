import { Module } from '@nestjs/common'
import { OverviewModule } from '../overview/overview.module'
import { InvestmentsController } from './investments.controller'
import { InvestmentsDetailService } from './investments-detail.service'
import { InvestmentsService } from './investments.service'

@Module({
  imports: [OverviewModule],
  controllers: [InvestmentsController],
  providers: [InvestmentsService, InvestmentsDetailService],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
