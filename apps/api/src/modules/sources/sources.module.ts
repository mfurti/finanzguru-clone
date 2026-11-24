import { Module } from '@nestjs/common'
import { CommonModule } from '../../common/common.module'
import { httpTransport } from './scalable-mcp/client'
import { ScalableCredentialStore } from './scalable-mcp/credential-store'
import { SCALABLE_TRANSPORT, ScalableMcpSource } from './scalable-mcp/scalable-mcp.source'
import { CsvSource } from './csv/csv.source'
import { DATA_SOURCES, type DataSource } from './data-source.interface'
import { SparkasseFintsSource } from './sparkasse-fints/sparkasse-fints.source'
import { SourcesRegistry } from './sources.registry'

@Module({
  imports: [CommonModule],
  providers: [
    CsvSource,
    SparkasseFintsSource,
    ScalableCredentialStore,
    { provide: SCALABLE_TRANSPORT, useValue: httpTransport },
    ScalableMcpSource,
    {
      provide: DATA_SOURCES,
      inject: [CsvSource, SparkasseFintsSource, ScalableMcpSource],
      useFactory: (...sources: DataSource[]) => sources,
    },
    SourcesRegistry,
  ],
  exports: [SourcesRegistry, CsvSource, ScalableCredentialStore, SCALABLE_TRANSPORT],
})
export class SourcesModule {}
