import { Module } from '@nestjs/common'
import { ImportModule } from '../import/import.module'
import { SourcesModule } from '../sources/sources.module'
import { MarketDataController } from './market-data.controller'
import { MarketDataService } from './market-data.service'
import { QuoteScheduler } from './quote.scheduler'

/** Market data for watchlists and holdings from the Scalable connection (005 US4). */
@Module({
  imports: [SourcesModule, ImportModule],
  controllers: [MarketDataController],
  providers: [MarketDataService, QuoteScheduler],
  exports: [MarketDataService],
})
export class MarketDataModule {}
