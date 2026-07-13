import type {
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

export const AMAZON_VISA_XLS_IMPORT_TYPE: ImportTypeDescriptor = {
  preset: 'amazon_visa_xls_v1',
  name: 'Amazon Visa (XLS)',
  extensions: ['.xls'],
  requiredColumns: ['Datum', 'Zeit', 'Karte', 'Beschreibung', 'Betrag'],
}

interface AmazonVisaIndices {
  dateIndex: number
  timeIndex: number
  cardIndex: number
  descriptionIndex: number
  amountIndex: number
  categoryIndex: number | undefined
  subcategoryIndex: number | undefined
  pointsIndex: number | undefined
}

function resolveAmazonVisaIndices(
  headerMap: Record<string, number[]>,
): AmazonVisaIndices {
  return {
    dateIndex: requiredIndex(headerMap, 'datum'),
    timeIndex: requiredIndex(headerMap, 'zeit'),
    cardIndex: requiredIndex(headerMap, 'karte'),
    descriptionIndex: requiredIndex(headerMap, 'beschreibung'),
    amountIndex: requiredIndex(headerMap, 'betrag'),
    categoryIndex: firstIndex(headerMap, 'umsatzkategorie'),
    subcategoryIndex: firstIndex(headerMap, 'unterkategorie'),
    pointsIndex: firstIndex(headerMap, 'punkte'),
  }
}

function extractCardholder(
  rows: unknown[][],
  headerRowIndex: number,
): string | null {
  for (const row of rows.slice(0, headerRowIndex)) {
    const label = normalizeText(row?.[0])?.toLowerCase() ?? ''
    if (!label.startsWith('karteninhaber')) continue
    return normalizeText(row?.[1])
  }
  return null
}

function parseAmazonVisaAmount(value: string): ParsedMoney | null {
  // Numeric cells are rendered by sheet_to_json as dot-decimal strings
  // ("-6.99"), which parseGermanMoney would misread as thousands-separated
  // ("-699,00 €"). Require the German comma format instead of importing
  // silently corrupted amounts.
  if (!value.includes(',')) return null
  return parseGermanMoney(value, 'EUR')
}

function buildAmazonVisaParsedRow(
  stringRow: string[],
  indices: AmazonVisaIndices,
  cardholder: string | null,
): NormalizedBankTransactionInput | null {
  const bookingDate = parseGermanDateToIso(stringRow[indices.dateIndex] ?? '')
  const parsedAmount = parseAmazonVisaAmount(
    stringRow[indices.amountIndex] ?? '',
  )
  if (!bookingDate || !parsedAmount) return null

  const rawData: Record<string, string | null> = {
    datum: normalizeText(stringRow[indices.dateIndex]),
    zeit: normalizeText(stringRow[indices.timeIndex]),
    karte: normalizeText(stringRow[indices.cardIndex]),
    beschreibung: normalizeText(stringRow[indices.descriptionIndex]),
    umsatzkategorie: pickOptional(
      stringRow,
      indices.categoryIndex,
      normalizeText,
    ),
    unterkategorie: pickOptional(
      stringRow,
      indices.subcategoryIndex,
      normalizeText,
    ),
    betrag: normalizeText(stringRow[indices.amountIndex]),
    punkte: pickOptional(stringRow, indices.pointsIndex, normalizeText),
  }

  return {
    externalTransactionId: null,
    bookingDate,
    valueDate: null,
    amountCents: parsedAmount.amountCents,
    currency: parsedAmount.currency,
    originalAmountCents: null,
    originalCurrency: null,
    counterparty: null,
    // Zeit feeds the fallback dedupe key so same-day purchases with
    // identical merchant and amount stay distinct.
    bookingText: rawData.zeit ?? null,
    description: rawData.beschreibung ?? null,
    purpose: null,
    status: 'booked',
    balanceAfterCents: null,
    balanceCurrency: null,
    country: null,
    cardLast4: extractCardLast4(stringRow[indices.cardIndex] ?? ''),
    cardholder,
    rawData,
  }
}

export async function parseAmazonVisaXlsFile(
  fileName: string,
  bytes: Uint8Array,
): Promise<ParsedImportFile> {
  const rows = readSpreadsheetRows(AMAZON_VISA_XLS_IMPORT_TYPE, fileName, bytes)
  const header = findHeaderRow(AMAZON_VISA_XLS_IMPORT_TYPE, rows)
  const indices = resolveAmazonVisaIndices(header.headerMap)
  const cardholder = extractCardholder(rows, header.headerRowIndex)

  const { rows: normalizedRows, warnings } = collectDataRows(
    rows,
    header.headerRowIndex,
    (stringRow) => buildAmazonVisaParsedRow(stringRow, indices, cardholder),
  )

  return {
    rows: normalizedRows,
    warnings,
    meta: {
      preset: 'amazon_visa_xls_v1',
      fileType: 'xls',
      totalRows: normalizedRows.length,
    },
  }
}
