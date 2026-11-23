import { Module } from '@nestjs/common'
import { ImportModule } from '../import/import.module'
import { InstrumentsController } from './instruments.controller'
import { InstrumentsService } from './instruments.service'

@Module({
  imports: [ImportModule],
  controllers: [InstrumentsController],
  providers: [InstrumentsService],
  exports: [InstrumentsService],
})
export class InstrumentsModule {}
