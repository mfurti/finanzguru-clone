import { Module } from '@nestjs/common'
import { MarketDataModule } from '../market-data/market-data.module'
import { SyncModule } from '../sources/sync.module'
import { RefreshController } from './refresh.controller'
import { RefreshService } from './refresh.service'

@Module({
  imports: [SyncModule, MarketDataModule],
  controllers: [RefreshController],
  providers: [RefreshService],
})
export class RefreshModule {}
