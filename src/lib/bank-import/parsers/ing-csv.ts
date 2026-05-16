import { parse as parseCsv } from '@std/csv'
import type {
  ImportTypeDescriptor,
  ParsedImportFile,
} from '@/lib/bank-import/types'
import { validationError } from '@/lib/bank-import/api-helpers'
import {
  normalizeCurrency,
  normalizeText,
  parseGermanDateToIso,
  parseGermanMoney,
} from '@/lib/bank-import/normalize'

const REQUIRED_ING_HEADERS = [
  'buchung',
  'wertstellungsdatum',
  'auftraggeberempfaenger',
  'buchungstext',
  'verwendungszweck',
  'saldo',
  'betrag',
] as const

const REQUIRED_ING_HEADER_LABELS: Record<
  (typeof REQUIRED_ING_HEADERS)[number],
  string
> = {
  buchung: 'Buchung',
  wertstellungsdatum: 'Wertstellungsdatum',
  auftraggeberempfaenger: 'Auftraggeber/Empfänger',
  buchungstext: 'Buchungstext',
  verwendungszweck: 'Verwendungszweck',
  saldo: 'Saldo',
  betrag: 'Betrag',
}

export const ING_CSV_IMPORT_TYPE: ImportTypeDescriptor = {
  preset: 'ing_csv_v1',
  name: 'ING (CSV)',
  extensions: ['.csv'],
  requiredColumns: [
    'Buchung',
    'Wertstellungsdatum',
    'Auftraggeber/Empfänger',
    'Buchungstext',
    'Verwendungszweck',
    'Saldo',
    'Betrag',
  ],
}

function repairMojibake(text: string): string {
  return text
    .replaceAll('Ã„', 'Ä')
    .replaceAll('Ã–', 'Ö')
    .replaceAll('Ãœ', 'Ü')
    .replaceAll('Ã¤', 'ä')
    .replaceAll('Ã¶', 'ö')
    .replaceAll('Ã¼', 'ü')
    .replaceAll('ÃŸ', 'ß')
}

function normalizeHeader(value: string): string {
  const normalized = normalizeText(value)
  if (!normalized) return ''

  return repairMojibake(normalized)
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .replace(/[^a-z0-9]+/g, '')
}

function buildHeaderIndex(headerColumns: string[]): Record<string, number[]> {
  const map: Record<string, number[]> = {}

  headerColumns.forEach((header, index) => {
    const key = normalizeHeader(header)
    if (!key) return
    map[key] = map[key] ? [...map[key], index] : [index]
  })

  return map
}

function parseRows(content: string): string[][] {
  try {
    const rows = parseCsv(content, { separator: ';' })
    return rows.map((row) => row.map((cell) => normalizeText(cell) ?? ''))
  } catch {
    throw validationError(
      'ING-CSV konnte nicht gelesen werden: Datei ist beschädigt oder hat ein ungültiges Format.',
    )
  }
}

function findHeaderRow(records: string[][]): {
  headerLineIndex: number
  headerColumns: string[]
} {
  for (let i = 0; i < records.length; i += 1) {
    const columns = (records[i] ?? []).map((column) => column.trim())
    if (columns.length === 0) continue

    const normalized = columns.map(normalizeHeader)
    const hasAllRequired = REQUIRED_ING_HEADERS.every((required) =>
      normalized.includes(required),
    )
    if (!hasAllRequired) continue

    return {
      headerLineIndex: i,
      headerColumns: columns,
    }
  }

  throw validationError(
    'ING-CSV konnte nicht gelesen werden: Kopfzeile mit Pflichtspalten nicht gefunden.',
  )
}

interface IngColumnIndexes {
  bookingDate: number
  valueDate: number
  counterparty: number
  bookingText: number
  purpose: number
  balance: number
  amount: number
  balanceCurrency: number | undefined
  amountCurrency: number | undefined
}

function ensureCsvExtension(fileName: string): void {
  if (fileName.toLowerCase().endsWith('.csv')) return
  throw validationError(
    'Ungültiger Dateityp für ING-Import. Erwartet wird eine CSV-Datei.',
  )
}

function ensureRequiredHeadersPresent(
  headerMap: Record<string, number[]>,
): void {
  const missingRequired = REQUIRED_ING_HEADERS.filter(
    (required) => (headerMap[required] ?? []).length === 0,
  )
  if (missingRequired.length === 0) return
  throw validationError(
    `ING-CSV konnte nicht gelesen werden: Pflichtspalten fehlen (${missingRequired.map((key) => REQUIRED_ING_HEADER_LABELS[key]).join(', ')}).`,
  )
}

function firstIndex(headerMap: Record<string, number[]>, key: string): number {
  return headerMap[key]?.[0] as number
}

function resolveCurrencyIndexes(
  currencyIndexes: number[],
  balance: number,
  amount: number,
): { balanceCurrency: number | undefined; amountCurrency: number | undefined } {
  const balanceCurrency = currencyIndexes.find(
    (index) => index > balance && index < amount,
  )
  const amountCurrency =
    currencyIndexes.find((index) => index > amount) ??
    currencyIndexes.find((index) => index !== balanceCurrency)
  return { balanceCurrency, amountCurrency }
}

function resolveColumnIndexes(
  headerMap: Record<string, number[]>,
): IngColumnIndexes {
  const balance = firstIndex(headerMap, 'saldo')
  const amount = firstIndex(headerMap, 'betrag')
  const currencyIndexes = headerMap.waehrung ?? []
  const { balanceCurrency, amountCurrency } = resolveCurrencyIndexes(
    currencyIndexes,
    balance,
    amount,
  )

  return {
    bookingDate: firstIndex(headerMap, 'buchung'),
    valueDate: firstIndex(headerMap, 'wertstellungsdatum'),
    counterparty: firstIndex(headerMap, 'auftraggeberempfaenger'),
    bookingText: firstIndex(headerMap, 'buchungstext'),
    purpose: firstIndex(headerMap, 'verwendungszweck'),
    balance,
    amount,
    balanceCurrency,
    amountCurrency,
  }
}

function readNormalized(
  values: string[],
  index: number | undefined,
): string | null {
  if (index === undefined) return null
  return normalizeText(values[index])
}

interface NormalizedIngRowFields {
  bookingDateRaw: string | null
  valueDateRaw: string | null
  counterparty: string | null
  bookingText: string | null
  purpose: string | null
  balanceRaw: string | null
  amountRaw: string | null
  balanceCurrency: string | null
  amountCurrency: string | null
}

function readNormalizedRowFields(
  values: string[],
  cols: IngColumnIndexes,
): NormalizedIngRowFields {
  return {
    bookingDateRaw: readNormalized(values, cols.bookingDate),
    valueDateRaw: readNormalized(values, cols.valueDate),
    counterparty: readNormalized(values, cols.counterparty),
    bookingText: readNormalized(values, cols.bookingText),
    purpose: readNormalized(values, cols.purpose),
    balanceRaw: readNormalized(values, cols.balance),
    amountRaw: readNormalized(values, cols.amount),
    balanceCurrency: readNormalized(values, cols.balanceCurrency),
    amountCurrency: readNormalized(values, cols.amountCurrency),
  }
}

function pickCurrency(primary: string | null, fallback: string | null): string {
  return primary ?? fallback ?? 'EUR'
}

function parseIngRow(
  values: string[],
  cols: IngColumnIndexes,
): ParsedImportFile['rows'][number] | null {
  const fields = readNormalizedRowFields(values, cols)
  const bookingDate = parseGermanDateToIso(fields.bookingDateRaw ?? '')
  const valueDate = parseGermanDateToIso(fields.valueDateRaw ?? '')

  const amount = parseGermanMoney(
    values[cols.amount],
    pickCurrency(fields.amountCurrency, fields.balanceCurrency),
  )
  if (!bookingDate || !amount) return null

  const balance = parseGermanMoney(
    values[cols.balance],
    pickCurrency(fields.balanceCurrency, fields.amountCurrency),
  )

  return {
    externalTransactionId: null,
    bookingDate,
    valueDate,
    amountCents: amount.amountCents,
    currency: normalizeCurrency(amount.currency, 'EUR'),
    originalAmountCents: null,
    originalCurrency: null,
    counterparty: fields.counterparty,
    bookingText: fields.bookingText,
    description: null,
    purpose: fields.purpose,
    status: 'booked',
    balanceAfterCents: balance?.amountCents ?? null,
    balanceCurrency: balance?.currency ?? null,
    country: null,
    cardLast4: null,
    cardholder: null,
    rawData: {
      buchung: fields.bookingDateRaw,
      wertstellungsdatum: fields.valueDateRaw,
      auftraggeberEmpfaenger: fields.counterparty,
      buchungstext: fields.bookingText,
      verwendungszweck: fields.purpose,
      saldo: fields.balanceRaw,
      saldoWaehrung: fields.balanceCurrency,
      betrag: fields.amountRaw,
      betragWaehrung: fields.amountCurrency,
    },
  }
}

function isEmptyRow(values: string[]): boolean {
  return values.every((value) => !normalizeText(value))
}

function parseIngRows(
  records: string[][],
  headerLineIndex: number,
  cols: IngColumnIndexes,
): { rows: ParsedImportFile['rows']; warnings: string[] } {
  const warnings: string[] = []
  const rows: ParsedImportFile['rows'] = []

  for (let i = headerLineIndex + 1; i < records.length; i += 1) {
    const values = records[i] ?? []
    if (isEmptyRow(values)) continue

    const parsed = parseIngRow(values, cols)
    if (!parsed) {
      warnings.push(
        `Zeile ${i + 1} konnte nicht importiert werden und wurde übersprungen.`,
      )
      continue
    }
    rows.push(parsed)
  }

  return { rows, warnings }
}

export async function parseIngCsvFile(
  fileName: string,
  bytes: Uint8Array,
): Promise<ParsedImportFile> {
  ensureCsvExtension(fileName)

  const content = new TextDecoder('iso-8859-1').decode(bytes)
  const records = parseRows(content)
  const { headerLineIndex, headerColumns } = findHeaderRow(records)
  const headerMap = buildHeaderIndex(headerColumns)

  ensureRequiredHeadersPresent(headerMap)
  const cols = resolveColumnIndexes(headerMap)
  const { rows, warnings } = parseIngRows(records, headerLineIndex, cols)

  return {
    rows,
    warnings,
    meta: {
      preset: 'ing_csv_v1',
      fileType: 'csv',
      totalRows: rows.length,
    },
  }
}
