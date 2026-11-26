import { Module } from '@nestjs/common'
import { ImportModule } from '../import/import.module'
import { ClassificationService } from './classification.service'
import { InstrumentsController } from './instruments.controller'
import { InstrumentsService } from './instruments.service'

@Module({
  imports: [ImportModule],
  controllers: [InstrumentsController],
  providers: [InstrumentsService, ClassificationService],
  exports: [InstrumentsService],
})
export class InstrumentsModule {}
