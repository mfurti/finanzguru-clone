import { Module } from '@nestjs/common'
import { LayoutController } from './layout.controller'
import { OverviewController } from './overview.controller'
import { OverviewService } from './overview.service'
import { PortfolioService } from './portfolio.service'

@Module({
  controllers: [LayoutController, OverviewController],
  providers: [OverviewService, PortfolioService],
  exports: [OverviewService, PortfolioService],
})
export class OverviewModule {}
