import { Module } from '@nestjs/common'
import { LayoutController } from './layout.controller'
import { OverviewController } from './overview.controller'
import { OverviewService } from './overview.service'

@Module({
  controllers: [LayoutController, OverviewController],
  providers: [OverviewService],
  exports: [OverviewService],
})
export class OverviewModule {}
