import { Injectable } from '@nestjs/common'
import type { SourceStatus } from '@finance/shared'
import type { DataSource, FetchInput, SyncBatch } from '../data-source.interface'
import { parseCsv } from './detector'
import { parseGenericMapped } from './generic-mapped'
import { parseScalable } from './scalable'
import { parseSparkasse } from './sparkasse'

export class NeedsMappingError extends Error {
  constructor() {
    super('Unknown CSV layout: a column mapping is required')
    this.name = 'NeedsMappingError'
  }
}

/** CSV file source: known layouts by header, everything else via a mapping. */
@Injectable()
export class CsvSource implements DataSource {
  readonly kind = 'csv' as const

  async status(): Promise<SourceStatus> {
    return 'active'
  }

  async fetch(input: FetchInput): Promise<SyncBatch> {
    if (input.kind !== 'csv') throw new Error('CsvSource only handles CSV uploads')
    if (input.mapping) {
      const csv = parseCsv(input.file, {
        delimiter: input.mapping.delimiter,
        encoding: input.mapping.encoding,
        skipRows: input.mapping.skipRows,
      })
      return parseGenericMapped(csv, input.mapping)
    }
    const csv = parseCsv(input.file)
    switch (csv.layout) {
      case 'sparkasse-camt-v8':
        return parseSparkasse(csv, 'camt')
      case 'sparkasse-mt940':
        return parseSparkasse(csv, 'mt940')
      case 'scalable-transactions':
        return parseScalable(csv)
      default:
        throw new NeedsMappingError()
    }
  }
}
