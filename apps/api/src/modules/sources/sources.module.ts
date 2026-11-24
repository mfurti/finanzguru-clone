import { Module } from '@nestjs/common'
import { CsvSource } from './csv/csv.source'
import { DATA_SOURCES, type DataSource } from './data-source.interface'
import { SparkasseFintsSource } from './sparkasse-fints/sparkasse-fints.source'
import { SourcesRegistry } from './sources.registry'

@Module({
  providers: [
    CsvSource,
    SparkasseFintsSource,
    {
      provide: DATA_SOURCES,
      inject: [CsvSource, SparkasseFintsSource],
      useFactory: (...sources: DataSource[]) => sources,
    },
    SourcesRegistry,
  ],
  exports: [SourcesRegistry, CsvSource],
})
export class SourcesModule {}
