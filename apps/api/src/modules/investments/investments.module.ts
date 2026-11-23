import { Module } from '@nestjs/common'
import { OverviewModule } from '../overview/overview.module'
import { InvestmentsController } from './investments.controller'
import { InvestmentsService } from './investments.service'

@Module({
  imports: [OverviewModule],
  controllers: [InvestmentsController],
  providers: [InvestmentsService],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
