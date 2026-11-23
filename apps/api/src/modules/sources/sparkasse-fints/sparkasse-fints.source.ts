import { Injectable } from '@nestjs/common'
import type { SourceStatus } from '@finance/shared'
import type { DataSource, FetchInput, SyncBatch } from '../data-source.interface'
import { NotImplementedError } from '../errors'

/**
 * Reserved slot for a live Sparkasse query (FinTS/PSD2), deferred to a later
 * feature (US7). Until then Sparkasse data comes from CSV exports.
 */
@Injectable()
export class SparkasseFintsSource implements DataSource {
  readonly kind = 'sparkasse_fints' as const

  async status(): Promise<SourceStatus> {
    return 'planned'
  }

  async fetch(_input: FetchInput): Promise<SyncBatch> {
    throw new NotImplementedError('Sparkasse live query is planned for a later version')
  }
}
