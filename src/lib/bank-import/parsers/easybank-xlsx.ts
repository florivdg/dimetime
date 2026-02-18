import * as XLSX from 'xlsx'
import type {
  BankTransactionStatus,
  ImportTypeDescriptor,
  ParsedImportFile,
} from '@/lib/bank-import/types'
import {
  extractCardLast4,
  normalizeText,
  parseGermanDateToIso,
  parseGermanMoney,
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

function normalizeHeader(value: unknown): string {
  return normalizeText(value)?.toLowerCase() ?? ''
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

  throw new Error(
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
  if (
    status.includes('vorgemerkt') ||
    status.includes('noch nicht abgerechnet')
  ) {
    return 'pending'
  }
  if (
    status.length === 0 ||
    status === '-' ||
    status.includes('gebucht') ||
    status.includes('abgerechnet')
  ) {
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

export async function parseEasybankXlsxFile(
  fileName: string,
  bytes: Uint8Array,
): Promise<ParsedImportFile> {
  if (!fileName.toLowerCase().endsWith('.xlsx')) {
    throw new Error(
      'Ungültiger Dateityp für easybank-Import. Erwartet wird eine XLSX-Datei.',
    )
  }

  const workbook = XLSX.read(bytes, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error('EasyBank-XLSX enthält kein Tabellenblatt.')
  }

  const sheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: '',
  }) as unknown[][]

  const { headerRowIndex, headerCells } = findHeaderRow(rows)
  const headerMap = buildHeaderIndex(headerCells)

  const bookingDateIndexes = headerMap['buchungsdatum'] ?? []
  const bookingDateIndex = bookingDateIndexes[0]
  const valueDateIndex = bookingDateIndexes[1]

  const referenceIndex = headerMap['referenznummer']?.[0]
  const amountIndex = headerMap['betrag']?.[0]
  const descriptionIndex = headerMap['beschreibung']?.[0]
  const typeIndex = headerMap['typ']?.[0]
  const statusIndex = headerMap['status']?.[0]
  const cardNumberIndex = headerMap['kartennummer']?.[0]
  const originalAmountIndex = headerMap['originalbetrag']?.[0]
  const countryIndex = headerMap['land']?.[0]
  const cardholderIndex = headerMap['karteninhaber']?.[0]
  const detailsIndex = headerMap['details']?.[0]

  if (
    bookingDateIndex === undefined ||
    amountIndex === undefined ||
    descriptionIndex === undefined ||
    typeIndex === undefined ||
    statusIndex === undefined
  ) {
    throw new Error(
      'EasyBank-XLSX konnte nicht gelesen werden: Pflichtspalten fehlen in der Kopfzeile.',
    )
  }

  const warnings: string[] = []
  const normalizedRows: ParsedImportFile['rows'] = []

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? []
    const stringRow = row.map((cell) => normalizeText(cell) ?? '')
    if (stringRow.every((value) => value.length === 0)) continue

    const bookingDate = parseGermanDateToIso(stringRow[bookingDateIndex] ?? '')
    const valueDate =
      valueDateIndex === undefined
        ? null
        : parseGermanDateToIso(stringRow[valueDateIndex] ?? '')

    const parsedAmount = parseGermanMoney(stringRow[amountIndex], 'EUR')
    if (!bookingDate || !parsedAmount) {
      warnings.push(
        `Zeile ${i + 1} konnte nicht importiert werden und wurde übersprungen.`,
      )
      continue
    }

    const typeRaw = normalizeText(stringRow[typeIndex])
    const normalizedAmountCents = amountByType(
      parsedAmount.amountCents,
      typeRaw,
    )
    const parsedOriginalAmount =
      originalAmountIndex === undefined
        ? null
        : parseGermanMoney(
            stringRow[originalAmountIndex],
            parsedAmount.currency,
          )

    normalizedRows.push({
      externalTransactionId:
        referenceIndex === undefined
          ? null
          : normalizeText(stringRow[referenceIndex]),
      bookingDate,
      valueDate,
      amountCents: normalizedAmountCents,
      currency: parsedAmount.currency,
      originalAmountCents: parsedOriginalAmount?.amountCents ?? null,
      originalCurrency: parsedOriginalAmount?.currency ?? null,
      counterparty: null,
      bookingText: typeRaw,
      description: normalizeText(stringRow[descriptionIndex]),
      purpose:
        detailsIndex === undefined
          ? null
          : normalizeText(stringRow[detailsIndex]),
      status: parseStatus(
        statusIndex === undefined ? null : stringRow[statusIndex],
      ),
      balanceAfterCents: null,
      balanceCurrency: null,
      country:
        countryIndex === undefined
          ? null
          : normalizeText(stringRow[countryIndex]),
      cardLast4:
        cardNumberIndex === undefined
          ? null
          : extractCardLast4(stringRow[cardNumberIndex]),
      cardholder:
        cardholderIndex === undefined
          ? null
          : normalizeText(stringRow[cardholderIndex]),
      rawData: {
        referenznummer:
          referenceIndex === undefined
            ? null
            : normalizeText(stringRow[referenceIndex]),
        buchungsdatum: normalizeText(stringRow[bookingDateIndex]),
        wertstellungsdatum:
          valueDateIndex === undefined
            ? null
            : normalizeText(stringRow[valueDateIndex]),
        betrag: normalizeText(stringRow[amountIndex]),
        beschreibung: normalizeText(stringRow[descriptionIndex]),
        typ: typeRaw,
        status:
          statusIndex === undefined
            ? null
            : normalizeText(stringRow[statusIndex]),
        kartennummer:
          cardNumberIndex === undefined
            ? null
            : normalizeText(stringRow[cardNumberIndex]),
        originalbetrag:
          originalAmountIndex === undefined
            ? null
            : normalizeText(stringRow[originalAmountIndex]),
        land:
          countryIndex === undefined
            ? null
            : normalizeText(stringRow[countryIndex]),
        karteninhaber:
          cardholderIndex === undefined
            ? null
            : normalizeText(stringRow[cardholderIndex]),
        details:
          detailsIndex === undefined
            ? null
            : normalizeText(stringRow[detailsIndex]),
      },
    })
  }

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

// Keep export used by unit-like checks and endpoint metadata.
export const EASYBANK_HEADER_NORMALIZER = normalizeHeader
