import type { TransactionExportColumn, TransactionListItem } from '@finance/shared'

/** German headers of the transactions export (FR-004). */
const HEADERS: Record<TransactionExportColumn, string> = {
  date: 'Datum',
  counterparty: 'Name',
  purpose: 'Verwendungszweck',
  category: 'Kategorie',
  tags: 'Tags',
  account: 'Konto',
  amount: 'Betrag',
}
export const DEFAULT_EXPORT_COLUMNS: TransactionExportColumn[] = [
  'date',
  'counterparty',
  'purpose',
  'category',
  'tags',
  'account',
  'amount',
]

const germanDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`
/** Cents as German decimal without currency sign ("-1234,50"), so spreadsheets read numbers. */
const germanAmount = (cents: number) => {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

function cell(row: TransactionListItem, column: TransactionExportColumn): string {
  switch (column) {
    case 'date':
      return germanDate(row.bookingDate)
    case 'counterparty':
      return row.counterparty ?? ''
    case 'purpose':
      return row.purpose ?? ''
    case 'category':
      return row.categoryName ?? ''
    case 'tags':
      return row.tags.map((item) => item.name).join(', ')
    case 'account':
      return row.accountName
    case 'amount':
      return germanAmount(row.amountCents)
  }
}

const BOM = String.fromCharCode(0xfeff)

/** `;`-separated CSV with UTF-8 BOM and CRLF, columns in the given order. */
export function transactionsListToCsv(
  rows: readonly TransactionListItem[],
  columns: readonly TransactionExportColumn[] = DEFAULT_EXPORT_COLUMNS,
): string {
  const quote = (value: string) =>
    /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  const lines = [
    columns.map((column) => quote(HEADERS[column])).join(';'),
    ...rows.map((row) => columns.map((column) => quote(cell(row, column))).join(';')),
  ]
  return `${BOM}${lines.join('\r\n')}\r\n`
}
