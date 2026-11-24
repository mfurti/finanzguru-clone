import { Module } from '@nestjs/common'
import { CommonModule } from '../../common/common.module'
import { ImportModule } from '../import/import.module'
import { httpTransport } from './scalable-mcp/client'
import { ScalableCredentialStore } from './scalable-mcp/credential-store'
import {
  SCALABLE_TRANSPORT,
  ScalableConnectionService,
} from './scalable-mcp/scalable-connection.service'
import { SourcesModule } from './sources.module'
import { SyncController } from './sync.controller'
import { SyncService } from './sync.service'

/**
 * Pull syncs and the Scalable connection (004 US1). Separate from
 * SourcesModule because ImportModule already depends on SourcesModule.
 */
@Module({
  imports: [SourcesModule, ImportModule, CommonModule],
  controllers: [SyncController],
  providers: [
    SyncService,
    ScalableCredentialStore,
    ScalableConnectionService,
    { provide: SCALABLE_TRANSPORT, useValue: httpTransport },
  ],
  exports: [SyncService],
})
export class SyncModule {}
