/**
 * DataSource contract (contracts/data-source.md). Types live in @finance/shared
 * so the web app sees the same shapes; implementations are Nest providers
 * registered under DATA_SOURCES and resolved by SourcesRegistry.
 */
export type {
  CsvMapping,
  CsvMappingColumns,
  CsvMappingOptions,
  DataSource,
  FetchInput,
  NormalizedAccount,
  NormalizedInstrument,
  NormalizedPrice,
  NormalizedTransaction,
  PositionSnapshotItem,
  RowError,
  SyncBatch,
} from '@finance/shared'
export { emptyBatch } from '@finance/shared'

/** Multi-provider token: every DataSource implementation is registered under it. */
export const DATA_SOURCES = Symbol('DATA_SOURCES')
