import { Module } from '@nestjs/common'
import { OverviewModule } from '../overview/overview.module'
import { TaxesController } from './taxes.controller'
import { TaxesService } from './taxes.service'

@Module({
  imports: [OverviewModule],
  controllers: [TaxesController],
  providers: [TaxesService],
})
export class TaxesModule {}
