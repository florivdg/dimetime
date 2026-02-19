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

export async function parseIngCsvFile(
  fileName: string,
  bytes: Uint8Array,
): Promise<ParsedImportFile> {
  if (!fileName.toLowerCase().endsWith('.csv')) {
    throw validationError(
      'Ungültiger Dateityp für ING-Import. Erwartet wird eine CSV-Datei.',
    )
  }

  const content = new TextDecoder('iso-8859-1').decode(bytes)
  const records = parseRows(content)
  const { headerLineIndex, headerColumns } = findHeaderRow(records)
  const headerMap = buildHeaderIndex(headerColumns)

  const missingRequired = REQUIRED_ING_HEADERS.filter(
    (required) => (headerMap[required] ?? []).length === 0,
  )
  if (missingRequired.length > 0) {
    throw validationError(
      `ING-CSV konnte nicht gelesen werden: Pflichtspalten fehlen (${missingRequired.map((key) => REQUIRED_ING_HEADER_LABELS[key]).join(', ')}).`,
    )
  }

  const bookingDateIndex = headerMap.buchung?.[0] as number
  const valueDateIndex = headerMap.wertstellungsdatum?.[0] as number
  const counterpartyIndex = headerMap.auftraggeberempfaenger?.[0] as number
  const bookingTextIndex = headerMap.buchungstext?.[0] as number
  const purposeIndex = headerMap.verwendungszweck?.[0] as number
  const balanceIndex = headerMap.saldo?.[0] as number
  const amountIndex = headerMap.betrag?.[0] as number
  const currencyIndexes = headerMap.waehrung ?? []

  const balanceCurrencyIndex = currencyIndexes.find(
    (index) => index > balanceIndex && index < amountIndex,
  )
  const amountCurrencyIndex =
    currencyIndexes.find((index) => index > amountIndex) ??
    currencyIndexes.find((index) => index !== balanceCurrencyIndex)

  const warnings: string[] = []
  const rows: ParsedImportFile['rows'] = []

  for (let i = headerLineIndex + 1; i < records.length; i += 1) {
    const values = records[i] ?? []
    if (values.every((value) => !normalizeText(value))) continue

    const bookingDate = parseGermanDateToIso(values[bookingDateIndex] ?? '')
    const valueDate = parseGermanDateToIso(values[valueDateIndex] ?? '')

    const amountCurrency =
      amountCurrencyIndex === undefined
        ? null
        : normalizeText(values[amountCurrencyIndex])
    const balanceCurrency =
      balanceCurrencyIndex === undefined
        ? null
        : normalizeText(values[balanceCurrencyIndex])

    const amount = parseGermanMoney(
      values[amountIndex],
      amountCurrency || balanceCurrency || 'EUR',
    )
    if (!bookingDate || !amount) {
      warnings.push(
        `Zeile ${i + 1} konnte nicht importiert werden und wurde übersprungen.`,
      )
      continue
    }

    const balance = parseGermanMoney(
      values[balanceIndex],
      balanceCurrency || amountCurrency || 'EUR',
    )

    rows.push({
      externalTransactionId: null,
      bookingDate,
      valueDate,
      amountCents: amount.amountCents,
      currency: normalizeCurrency(amount.currency, 'EUR'),
      originalAmountCents: null,
      originalCurrency: null,
      counterparty: normalizeText(values[counterpartyIndex]),
      bookingText: normalizeText(values[bookingTextIndex]),
      description: null,
      purpose: normalizeText(values[purposeIndex]),
      status: 'booked',
      balanceAfterCents: balance?.amountCents ?? null,
      balanceCurrency: balance?.currency ?? null,
      country: null,
      cardLast4: null,
      cardholder: null,
      rawData: {
        buchung: normalizeText(values[bookingDateIndex]),
        wertstellungsdatum: normalizeText(values[valueDateIndex]),
        auftraggeberEmpfaenger: normalizeText(values[counterpartyIndex]),
        buchungstext: normalizeText(values[bookingTextIndex]),
        verwendungszweck: normalizeText(values[purposeIndex]),
        saldo: normalizeText(values[balanceIndex]),
        saldoWaehrung:
          balanceCurrencyIndex === undefined
            ? null
            : normalizeText(values[balanceCurrencyIndex]),
        betrag: normalizeText(values[amountIndex]),
        betragWaehrung:
          amountCurrencyIndex === undefined
            ? null
            : normalizeText(values[amountCurrencyIndex]),
      },
    })
  }

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
