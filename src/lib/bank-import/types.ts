export type ImportPreset =
  | 'ing_csv_v1'
  | 'easybank_xlsx_v1'
  | 'enable_banking_v1'

export type ImportSourceKind = 'bank_account' | 'credit_card' | 'other'

export type ConnectionType = 'file_upload' | 'enable_banking'

export type DefaultPlanAssignment = 'auto_month' | 'none'

export type ImportFileType = 'csv' | 'xlsx' | 'api'

export type ImportPhase = 'preview' | 'commit'

export type ImportStatus = 'success' | 'failed'

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
