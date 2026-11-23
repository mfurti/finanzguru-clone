import { Module } from '@nestjs/common'
import { CsvSource } from './csv/csv.source'
import { DATA_SOURCES, type DataSource } from './data-source.interface'
import { SourcesController } from './sources.controller'
import { SourcesRegistry } from './sources.registry'

@Module({
  controllers: [SourcesController],
  providers: [
    CsvSource,
    {
      provide: DATA_SOURCES,
      inject: [CsvSource],
      useFactory: (...sources: DataSource[]) => sources,
    },
    SourcesRegistry,
  ],
  exports: [SourcesRegistry, CsvSource],
})
export class SourcesModule {}
