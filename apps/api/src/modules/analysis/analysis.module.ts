import { Module } from '@nestjs/common'
import { OverviewModule } from '../overview/overview.module'
import { AnalysisController, GroupingsController, InflationController } from './analysis.controller'
import { AnalysisService } from './analysis.service'
import { GroupingsService } from './groupings.service'

@Module({
  imports: [OverviewModule],
  controllers: [AnalysisController, GroupingsController, InflationController],
  providers: [AnalysisService, GroupingsService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
