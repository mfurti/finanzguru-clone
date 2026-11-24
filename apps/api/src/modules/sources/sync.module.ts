import { Module } from '@nestjs/common'
import { ImportModule } from '../import/import.module'
import { SourcesModule } from './sources.module'
import { SyncService } from './sync.service'

/** Pull syncs (004 US1); separate from SourcesModule because ImportModule depends on it. */
@Module({
  imports: [SourcesModule, ImportModule],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
