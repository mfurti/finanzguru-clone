/**
 * Normalized records every data source produces (contracts/data-source.md).
 * Persistence, dedupe, categorization and recomputation happen in the shared
 * import pipeline, never in a source.
 */
import type { AccountType, AssetClass, SourceKind, SourceStatus, TransactionType } from './enums.js'

export interface NormalizedAccount {
  /** Stable id within the source. */
  externalRef: string
  name: string
  type: AccountType
  iban?: string
  institutionName: string
  /** Cash accounts only. */
  balanceCents?: number
  parentExternalRef?: string
}

export interface NormalizedInstrument {
  isin: string
  wkn?: string
  name: string
  assetClass: AssetClass
  currency: string
}

export interface NormalizedTransaction {
  accountExternalRef: string
  /** Source-native id; unique per source. */
  sourceRef?: string
  bookingDate: string
  valueDate?: string
  /** + inflow / − outflow. */
  amountCents: number
  type: TransactionType
  counterparty?: string
  counterpartyIban?: string
  purpose?: string
  isin?: string
  quantity?: string
  unitPrice?: string
  feeCents?: number
  taxCents?: number
}

export interface NormalizedPrice {
  isin: string
  date: string
  close: string
}

export interface PositionSnapshotItem {
  accountExternalRef: string
  isin: string
  quantity: string
}

export interface RowError {
  line?: number
  reason: string
}

export interface SyncBatch {
  accounts: NormalizedAccount[]
  instruments: NormalizedInstrument[]
  transactions: NormalizedTransaction[]
  prices: NormalizedPrice[]
  /** For reconciliation against derived lots. */
  positionsSnapshot?: PositionSnapshotItem[]
  rowErrors: RowError[]
}

export interface CsvMappingColumns {
  date: number
  amount: number
  valueDate?: number
  counterparty?: number
  iban?: number
  purpose?: number
  isin?: number
  quantity?: number
  price?: number
  fee?: number
  tax?: number
  type?: number
}

export interface CsvMappingOptions {
  delimiter: ';' | ',' | '\t'
  encoding: 'utf-8' | 'windows-1252'
  dateFormat: 'DD.MM.YYYY' | 'DD.MM.YY' | 'YYYY-MM-DD'
  decimalSeparator: ',' | '.'
  skipRows: number
}

export interface CsvMapping extends CsvMappingOptions {
  columns: CsvMappingColumns
}

export type FetchInput =
  | { kind: 'csv'; file: Buffer; fileName: string; mapping?: CsvMapping }
  | { kind: 'pull'; since?: string }

export interface DataSource {
  readonly kind: SourceKind
  status(): Promise<SourceStatus>
  /** CSV: parse the uploaded file. Pull sources: fetch since the cursor. Must be read-only. */
  fetch(input: FetchInput): Promise<SyncBatch>
}

export function emptyBatch(): SyncBatch {
  return { accounts: [], instruments: [], transactions: [], prices: [], rowErrors: [] }
}
