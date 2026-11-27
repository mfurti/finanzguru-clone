import { Module } from '@nestjs/common'
import { MarketDataModule } from '../market-data/market-data.module'
import { SyncModule } from '../sources/sync.module'
import { RefreshController } from './refresh.controller'
import { RefreshScheduler } from './refresh.scheduler'
import { RefreshService } from './refresh.service'

@Module({
  imports: [SyncModule, MarketDataModule],
  controllers: [RefreshController],
  providers: [RefreshService, RefreshScheduler],
  exports: [RefreshService],
})
export class RefreshModule {}
