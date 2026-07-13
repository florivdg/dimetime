import type {
  BankTransactionStatus,
  ImportTypeDescriptor,
  NormalizedBankTransactionInput,
  ParsedImportFile,
} from '@/lib/bank-import/types'
import {
  extractCardLast4,
  normalizeText,
  parseGermanDateToIso,
  parseGermanMoney,
  type ParsedMoney,
} from '@/lib/bank-import/normalize'
import {
  collectDataRows,
  findHeaderRow,
  firstIndex,
  pickOptional,
  readSpreadsheetRows,
  requiredIndex,
} from './spreadsheet'

export const EASYBANK_XLSX_IMPORT_TYPE: ImportTypeDescriptor = {
  preset: 'easybank_xlsx_v1',
  name: 'easybank (XLSX)',
  extensions: ['.xlsx'],
  requiredColumns: [
    'Referenznummer',
    'Buchungsdatum',
    'Betrag',
    'Beschreibung',
    'Typ',
    'Status',
  ],
}

interface EasybankIndices {
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

const BOOKED_MARKERS = ['', '-']

function isBookedStatus(status: string): boolean {
  return BOOKED_MARKERS.includes(status) || status.includes('abgerechnet')
}

function parseStatus(statusRaw: string | null): BankTransactionStatus {
  const status = (statusRaw ?? '').toLowerCase()
  if (status.includes('vorgemerkt')) return 'pending'
  if (isBookedStatus(status)) return 'booked'
  return 'unknown'
}

function amountByType(amountCents: number, typeRaw: string | null): number {
  const normalizedType = (typeRaw ?? '').toLowerCase()
  if (normalizedType.includes('belastung')) return -Math.abs(amountCents)
  if (normalizedType.includes('gutschrift')) return Math.abs(amountCents)
  return amountCents
}

function resolveEasybankIndices(
  headerMap: Record<string, number[]>,
): EasybankIndices {
  return {
    bookingDateIndex: requiredIndex(headerMap, 'buchungsdatum'),
    valueDateIndex: headerMap['buchungsdatum']?.[1],
    referenceIndex: firstIndex(headerMap, 'referenznummer'),
    amountIndex: requiredIndex(headerMap, 'betrag'),
    descriptionIndex: requiredIndex(headerMap, 'beschreibung'),
    typeIndex: requiredIndex(headerMap, 'typ'),
    statusIndex: requiredIndex(headerMap, 'status'),
    cardNumberIndex: firstIndex(headerMap, 'kartennummer'),
    originalAmountIndex: firstIndex(headerMap, 'originalbetrag'),
    countryIndex: firstIndex(headerMap, 'land'),
    cardholderIndex: firstIndex(headerMap, 'karteninhaber'),
    detailsIndex: firstIndex(headerMap, 'details'),
  }
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

function parseEasybankRow(
  stringRow: string[],
  indices: EasybankIndices,
): NormalizedBankTransactionInput | null {
  const bookingDate = parseGermanDateToIso(
    stringRow[indices.bookingDateIndex] ?? '',
  )
  const parsedAmount = parseGermanMoney(stringRow[indices.amountIndex], 'EUR')
  if (!bookingDate || !parsedAmount) return null

  return buildEasybankParsedRow(stringRow, indices, bookingDate, parsedAmount)
}

export async function parseEasybankXlsxFile(
  fileName: string,
  bytes: Uint8Array,
): Promise<ParsedImportFile> {
  const rows = readSpreadsheetRows(EASYBANK_XLSX_IMPORT_TYPE, fileName, bytes)
  const header = findHeaderRow(EASYBANK_XLSX_IMPORT_TYPE, rows)
  const indices = resolveEasybankIndices(header.headerMap)

  const { rows: normalizedRows, warnings } = collectDataRows(
    rows,
    header.headerRowIndex,
    (stringRow) => parseEasybankRow(stringRow, indices),
  )

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
