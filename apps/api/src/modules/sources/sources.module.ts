import { Module } from '@nestjs/common'
import { CommonModule } from '../../common/common.module'
import { httpTransport } from './scalable-mcp/client'
import { ScalableCredentialStore } from './scalable-mcp/credential-store'
import { SCALABLE_TRANSPORT, ScalableMcpSource } from './scalable-mcp/scalable-mcp.source'
import { CsvSource } from './csv/csv.source'
import { DATA_SOURCES, type DataSource } from './data-source.interface'
import { ENABLE_BANKING_HTTP, fetchHttp } from './enable-banking/client'
import { EnableBankingConnectionService } from './enable-banking/enable-banking-connection.service'
import { EnableBankingSource } from './enable-banking/enable-banking.source'
import { SourcesRegistry } from './sources.registry'

@Module({
  imports: [CommonModule],
  providers: [
    CsvSource,
    ScalableCredentialStore,
    { provide: SCALABLE_TRANSPORT, useValue: httpTransport },
    ScalableMcpSource,
    { provide: ENABLE_BANKING_HTTP, useValue: fetchHttp },
    EnableBankingConnectionService,
    EnableBankingSource,
    {
      provide: DATA_SOURCES,
      inject: [CsvSource, ScalableMcpSource, EnableBankingSource],
      useFactory: (...sources: DataSource[]) => sources,
    },
    SourcesRegistry,
  ],
  exports: [
    SourcesRegistry,
    CsvSource,
    ScalableCredentialStore,
    SCALABLE_TRANSPORT,
    EnableBankingConnectionService,
    ENABLE_BANKING_HTTP,
  ],
})
export class SourcesModule {}
