export const IMPORT_PRESETS = [
  'ing_csv_v1',
  'easybank_xlsx_v1',
  'amazon_visa_xls_v1',
] as const

export type ImportPreset = (typeof IMPORT_PRESETS)[number]

export type DefaultPlanAssignment = 'auto_month' | 'none'

export type ImportFileType = 'csv' | 'xlsx' | 'xls'

export type BankTransactionStatus = 'booked' | 'pending' | 'unknown'

export interface NormalizedBankTransactionInput {
  externalTransactionId: string | null
  bookingDate: string
  valueDate: string | null
  amountCents: number
  currency: string
  originalAmountCents: number | null
  originalCurrency: string | null
  counterparty: string | null
  bookingText: string | null
  description: string | null
  purpose: string | null
  status: BankTransactionStatus
  balanceAfterCents: number | null
  balanceCurrency: string | null
  country: string | null
  cardLast4: string | null
  cardholder: string | null
  rawData: Record<string, string | null>
}

export interface ParserMeta {
  preset: ImportPreset
  fileType: ImportFileType
  totalRows: number
}

export interface ParsedImportFile {
  rows: NormalizedBankTransactionInput[]
  warnings: string[]
  meta: ParserMeta
}

export interface ImportTypeDescriptor {
  preset: ImportPreset
  name: string
  extensions: string[]
  requiredColumns: string[]
}
