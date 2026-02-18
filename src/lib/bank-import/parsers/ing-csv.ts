import type {
  ImportTypeDescriptor,
  ParsedImportFile,
} from '@/lib/bank-import/types'
import {
  normalizeCurrency,
  normalizeText,
  parseGermanDateToIso,
  parseGermanMoney,
} from '@/lib/bank-import/normalize'

const ING_HEADER = [
  'Buchung',
  'Wertstellungsdatum',
  'Auftraggeber/Empfänger',
  'Buchungstext',
  'Verwendungszweck',
  'Saldo',
  'Währung',
  'Betrag',
  'Währung',
]

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

function parseSemicolonLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ';' && !inQuotes) {
      result.push(current)
      current = ''
      continue
    }

    current += char
  }

  result.push(current)
  return result
}

export async function parseIngCsvFile(
  fileName: string,
  bytes: Uint8Array,
): Promise<ParsedImportFile> {
  if (!fileName.toLowerCase().endsWith('.csv')) {
    throw new Error(
      'Ungültiger Dateityp für ING-Import. Erwartet wird eine CSV-Datei.',
    )
  }

  const content = new TextDecoder('iso-8859-1').decode(bytes)
  const lines = content.split(/\r?\n/)
  const headerLineIndex = lines.findIndex((line) =>
    line.trim().startsWith('Buchung;Wertstellungsdatum;'),
  )

  if (headerLineIndex < 0) {
    throw new Error(
      'ING-CSV konnte nicht gelesen werden: Kopfzeile nicht gefunden.',
    )
  }

  const headerColumns = parseSemicolonLine(lines[headerLineIndex]).map(
    (column) => column.trim(),
  )

  if (headerColumns.length < ING_HEADER.length) {
    throw new Error(
      'ING-CSV konnte nicht gelesen werden: Kopfzeile hat zu wenige Spalten.',
    )
  }

  const warnings: string[] = []
  const rows: ParsedImportFile['rows'] = []

  for (let i = headerLineIndex + 1; i < lines.length; i += 1) {
    const line = lines[i]?.trim()
    if (!line) continue

    const values = parseSemicolonLine(line)
    if (values.every((value) => !normalizeText(value))) continue

    const bookingDate = parseGermanDateToIso(values[0] ?? '')
    const valueDate = parseGermanDateToIso(values[1] ?? '')

    const amount = parseGermanMoney(values[7], values[8] || values[6] || 'EUR')
    if (!bookingDate || !amount) {
      warnings.push(
        `Zeile ${i + 1} konnte nicht importiert werden und wurde übersprungen.`,
      )
      continue
    }

    const balance = parseGermanMoney(values[5], values[6] || 'EUR')

    rows.push({
      externalTransactionId: null,
      bookingDate,
      valueDate,
      amountCents: amount.amountCents,
      currency: normalizeCurrency(amount.currency, 'EUR'),
      originalAmountCents: null,
      originalCurrency: null,
      counterparty: normalizeText(values[2]),
      bookingText: normalizeText(values[3]),
      description: null,
      purpose: normalizeText(values[4]),
      status: 'booked',
      balanceAfterCents: balance?.amountCents ?? null,
      balanceCurrency: balance?.currency ?? null,
      country: null,
      cardLast4: null,
      cardholder: null,
      rawData: {
        buchung: normalizeText(values[0]),
        wertstellungsdatum: normalizeText(values[1]),
        auftraggeberEmpfaenger: normalizeText(values[2]),
        buchungstext: normalizeText(values[3]),
        verwendungszweck: normalizeText(values[4]),
        saldo: normalizeText(values[5]),
        saldoWaehrung: normalizeText(values[6]),
        betrag: normalizeText(values[7]),
        betragWaehrung: normalizeText(values[8]),
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
