import { Module } from '@nestjs/common'
import { OverviewModule } from '../overview/overview.module'
import { DividendsController } from './dividends.controller'
import { DividendsService } from './dividends.service'

@Module({
  imports: [OverviewModule],
  controllers: [DividendsController],
  providers: [DividendsService],
})
export class DividendsModule {}
