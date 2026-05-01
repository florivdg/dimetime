import * as XLSX from 'xlsx'
import type {
  BankTransactionStatus,
  ImportTypeDescriptor,
  NormalizedBankTransactionInput,
  ParsedImportFile,
} from '@/lib/bank-import/types'
import { ImportApiError, validationError } from '@/lib/bank-import/api-helpers'
import {
  extractCardLast4,
  normalizeText,
  parseGermanDateToIso,
  parseGermanMoney,
  type ParsedMoney,
} from '@/lib/bank-import/normalize'

const REQUIRED_COLUMNS = [
  'Referenznummer',
  'Buchungsdatum',
  'Betrag',
  'Beschreibung',
  'Typ',
  'Status',
]

export const EASYBANK_XLSX_IMPORT_TYPE: ImportTypeDescriptor = {
  preset: 'easybank_xlsx_v1',
  name: 'easybank (XLSX)',
  extensions: ['.xlsx'],
  requiredColumns: REQUIRED_COLUMNS,
}

interface EasybankIndices {
  headerRowIndex: number
  bookingDateIndex: number
  valueDateIndex: number | undefined
  referenceIndex: number | undefined
  amountIndex: number
  descriptionIndex: number
  typeIndex: number
  statusIndex: number
  cardNumberIndex: number | undefined
  originalAmountIndex: number | undefined
  countryIndex: number | undefined
  cardholderIndex: number | undefined
  detailsIndex: number | undefined
}

function findHeaderRow(rows: unknown[][]): {
  headerRowIndex: number
  headerCells: string[]
} {
  for (let i = 0; i < rows.length; i += 1) {
    const headerCells = (rows[i] ?? []).map((cell) => normalizeText(cell) ?? '')
    const normalized = headerCells.map((value) => value.toLowerCase())

    const hasAllRequired = REQUIRED_COLUMNS.every((column) =>
      normalized.includes(column.toLowerCase()),
    )
    if (!hasAllRequired) continue

    return { headerRowIndex: i, headerCells }
  }

  throw validationError(
    'EasyBank-XLSX konnte nicht gelesen werden: Kopfzeile nicht gefunden.',
  )
}

function buildHeaderIndex(headerCells: string[]): Record<string, number[]> {
  const map: Record<string, number[]> = {}

  headerCells.forEach((header, index) => {
    const key = header.toLowerCase()
    map[key] = map[key] ? [...map[key], index] : [index]
  })

  return map
}

function parseStatus(statusRaw: string | null): BankTransactionStatus {
  const status = (statusRaw ?? '').toLowerCase()
  if (status.includes('vorgemerkt')) {
    return 'pending'
  }
  if (status.length === 0 || status === '-' || status.includes('abgerechnet')) {
    return 'booked'
  }
  return 'unknown'
}

function amountByType(amountCents: number, typeRaw: string | null): number {
  const normalizedType = (typeRaw ?? '').toLowerCase()
  if (normalizedType.includes('belastung')) return -Math.abs(amountCents)
  if (normalizedType.includes('gutschrift')) return Math.abs(amountCents)
  return amountCents
}

function readEasybankWorkbook(bytes: Uint8Array): XLSX.WorkBook {
  try {
    return XLSX.read(bytes, { type: 'array' })
  } catch (error) {
    if (error instanceof ImportApiError) throw error
    throw validationError(
      'EasyBank-XLSX konnte nicht gelesen werden: Datei ist beschädigt oder hat ein ungültiges Format.',
    )
  }
}

function loadEasybankWorkbook(
  fileName: string,
  bytes: Uint8Array,
): XLSX.WorkBook {
  if (!fileName.toLowerCase().endsWith('.xlsx')) {
    throw validationError(
      'Ungültiger Dateityp für easybank-Import. Erwartet wird eine XLSX-Datei.',
    )
  }

  const workbook = readEasybankWorkbook(bytes)

  if (!workbook.SheetNames[0]) {
    throw validationError('EasyBank-XLSX enthält kein Tabellenblatt.')
  }

  return workbook
}

function firstIndex(
  headerMap: Record<string, number[]>,
  key: string,
): number | undefined {
  return headerMap[key]?.[0]
}

function requireIndex(
  headerMap: Record<string, number[]>,
  key: string,
): number {
  const index = firstIndex(headerMap, key)
  if (index === undefined) {
    throw validationError(
      'EasyBank-XLSX konnte nicht gelesen werden: Pflichtspalten fehlen in der Kopfzeile.',
    )
  }
  return index
}

function resolveEasybankHeaderIndices(rows: unknown[][]): EasybankIndices {
  const { headerRowIndex, headerCells } = findHeaderRow(rows)
  const headerMap = buildHeaderIndex(headerCells)

  return {
    headerRowIndex,
    bookingDateIndex: requireIndex(headerMap, 'buchungsdatum'),
    valueDateIndex: headerMap['buchungsdatum']?.[1],
    referenceIndex: firstIndex(headerMap, 'referenznummer'),
    amountIndex: requireIndex(headerMap, 'betrag'),
    descriptionIndex: requireIndex(headerMap, 'beschreibung'),
    typeIndex: requireIndex(headerMap, 'typ'),
    statusIndex: requireIndex(headerMap, 'status'),
    cardNumberIndex: firstIndex(headerMap, 'kartennummer'),
    originalAmountIndex: firstIndex(headerMap, 'originalbetrag'),
    countryIndex: firstIndex(headerMap, 'land'),
    cardholderIndex: firstIndex(headerMap, 'karteninhaber'),
    detailsIndex: firstIndex(headerMap, 'details'),
  }
}

function pickOptional<T>(
  stringRow: string[],
  index: number | undefined,
  transform: (value: string) => T | null,
): T | null {
  if (index === undefined) return null
  return transform(stringRow[index] ?? '')
}

interface EasybankFieldTexts {
  reference: string | null
  valueDate: string | null
  cardNumber: string | null
  originalAmount: string | null
  country: string | null
  cardholder: string | null
  details: string | null
  status: string | null
}

function extractEasybankFieldTexts(
  stringRow: string[],
  indices: EasybankIndices,
): EasybankFieldTexts {
  return {
    reference: pickOptional(stringRow, indices.referenceIndex, normalizeText),
    valueDate: pickOptional(stringRow, indices.valueDateIndex, normalizeText),
    cardNumber: pickOptional(stringRow, indices.cardNumberIndex, normalizeText),
    originalAmount: pickOptional(
      stringRow,
      indices.originalAmountIndex,
      normalizeText,
    ),
    country: pickOptional(stringRow, indices.countryIndex, normalizeText),
    cardholder: pickOptional(stringRow, indices.cardholderIndex, normalizeText),
    details: pickOptional(stringRow, indices.detailsIndex, normalizeText),
    status: pickOptional(stringRow, indices.statusIndex, normalizeText),
  }
}

function buildEasybankRawData(
  stringRow: string[],
  indices: EasybankIndices,
  texts: EasybankFieldTexts,
  typeRaw: string | null,
): Record<string, string | null> {
  return {
    referenznummer: texts.reference,
    buchungsdatum: normalizeText(stringRow[indices.bookingDateIndex]),
    wertstellungsdatum: texts.valueDate,
    betrag: normalizeText(stringRow[indices.amountIndex]),
    beschreibung: normalizeText(stringRow[indices.descriptionIndex]),
    typ: typeRaw,
    status: texts.status,
    kartennummer: texts.cardNumber,
    originalbetrag: texts.originalAmount,
    land: texts.country,
    karteninhaber: texts.cardholder,
    details: texts.details,
  }
}

function parseOriginalAmount(
  stringRow: string[],
  indices: EasybankIndices,
  fallbackCurrency: string,
): { amountCents: number | null; currency: string | null } {
  const parsed = pickOptional(stringRow, indices.originalAmountIndex, (value) =>
    parseGermanMoney(value, fallbackCurrency),
  )
  if (!parsed) return { amountCents: null, currency: null }
  return { amountCents: parsed.amountCents, currency: parsed.currency }
}

function buildEasybankParsedRow(
  stringRow: string[],
  indices: EasybankIndices,
  bookingDate: string,
  parsedAmount: ParsedMoney,
): NormalizedBankTransactionInput {
  const typeRaw = normalizeText(stringRow[indices.typeIndex])
  const texts = extractEasybankFieldTexts(stringRow, indices)
  const original = parseOriginalAmount(
    stringRow,
    indices,
    parsedAmount.currency,
  )

  return {
    externalTransactionId: texts.reference,
    bookingDate,
    valueDate: pickOptional(
      stringRow,
      indices.valueDateIndex,
      parseGermanDateToIso,
    ),
    amountCents: amountByType(parsedAmount.amountCents, typeRaw),
    currency: parsedAmount.currency,
    originalAmountCents: original.amountCents,
    originalCurrency: original.currency,
    counterparty: null,
    bookingText: typeRaw,
    description: normalizeText(stringRow[indices.descriptionIndex]),
    purpose: texts.details,
    status: parseStatus(texts.status),
    balanceAfterCents: null,
    balanceCurrency: null,
    country: texts.country,
    cardLast4: pickOptional(
      stringRow,
      indices.cardNumberIndex,
      extractCardLast4,
    ),
    cardholder: texts.cardholder,
    rawData: buildEasybankRawData(stringRow, indices, texts, typeRaw),
  }
}

function normalizeStringRow(row: unknown[]): string[] {
  return row.map((cell) => normalizeText(cell) ?? '')
}

function isBlankRow(stringRow: string[]): boolean {
  return stringRow.every((value) => value.length === 0)
}

function parseRequiredFields(
  stringRow: string[],
  indices: EasybankIndices,
): { bookingDate: string; parsedAmount: ParsedMoney } | null {
  const bookingDate = parseGermanDateToIso(
    stringRow[indices.bookingDateIndex] ?? '',
  )
  const parsedAmount = parseGermanMoney(stringRow[indices.amountIndex], 'EUR')
  if (!bookingDate || !parsedAmount) return null
  return { bookingDate, parsedAmount }
}

function parseEasybankRow(
  row: unknown[],
  indices: EasybankIndices,
  lineNumber: number,
): { row: NormalizedBankTransactionInput | null; warning?: string } {
  const stringRow = normalizeStringRow(row)
  if (isBlankRow(stringRow)) return { row: null }

  const required = parseRequiredFields(stringRow, indices)
  if (!required) {
    return {
      row: null,
      warning: `Zeile ${lineNumber} konnte nicht importiert werden und wurde übersprungen.`,
    }
  }

  return {
    row: buildEasybankParsedRow(
      stringRow,
      indices,
      required.bookingDate,
      required.parsedAmount,
    ),
  }
}

function readEasybankRows(workbook: XLSX.WorkBook): unknown[][] {
  const firstSheetName = workbook.SheetNames[0]!
  const sheet = workbook.Sheets[firstSheetName]
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: '',
  }) as unknown[][]
}

function collectEasybankRows(
  rows: unknown[][],
  indices: EasybankIndices,
): { rows: NormalizedBankTransactionInput[]; warnings: string[] } {
  const dataRows = rows.slice(indices.headerRowIndex + 1)
  const results = dataRows.map((row, offset) =>
    parseEasybankRow(row ?? [], indices, indices.headerRowIndex + offset + 2),
  )
  return {
    rows: results.flatMap((r) => (r.row ? [r.row] : [])),
    warnings: results.flatMap((r) => (r.warning ? [r.warning] : [])),
  }
}

export async function parseEasybankXlsxFile(
  fileName: string,
  bytes: Uint8Array,
): Promise<ParsedImportFile> {
  const workbook = loadEasybankWorkbook(fileName, bytes)
  const rows = readEasybankRows(workbook)
  const indices = resolveEasybankHeaderIndices(rows)
  const { rows: normalizedRows, warnings } = collectEasybankRows(rows, indices)

  return {
    rows: normalizedRows,
    warnings,
    meta: {
      preset: 'easybank_xlsx_v1',
      fileType: 'xlsx',
      totalRows: normalizedRows.length,
    },
  }
}
