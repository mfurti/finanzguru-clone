import { Module } from '@nestjs/common'
import { SourcesModule } from '../sources/sources.module'
import { ImportController } from './import.controller'
import { ImportPipeline } from './import.pipeline'
import { ImportService } from './import.service'
import { RecomputeService } from './recompute.service'

@Module({
  imports: [SourcesModule],
  controllers: [ImportController],
  providers: [RecomputeService, ImportPipeline, ImportService],
  exports: [RecomputeService, ImportPipeline],
})
export class ImportModule {}
