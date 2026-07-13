import * as XLSX from 'xlsx'
import { validationError } from '@/lib/bank-import/api-helpers'
import { normalizeText } from '@/lib/bank-import/normalize'
import type {
  ImportTypeDescriptor,
  NormalizedBankTransactionInput,
} from '@/lib/bank-import/types'

export interface SpreadsheetHeader {
  headerRowIndex: number
  /** Lowercased header text → column indices (duplicates keep all). */
  headerMap: Record<string, number[]>
}

export function readSpreadsheetRows(
  descriptor: ImportTypeDescriptor,
  fileName: string,
  bytes: Uint8Array,
): unknown[][] {
  const lowerName = fileName.toLowerCase()
  const hasExpectedExtension = descriptor.extensions.some((extension) =>
    lowerName.endsWith(extension),
  )
  if (!hasExpectedExtension) {
    throw validationError(
      `Ungültiger Dateityp für ${descriptor.name}. Erwartet: ${descriptor.extensions.join(', ')}.`,
    )
  }

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(bytes, { type: 'array' })
  } catch {
    throw validationError(
      `${descriptor.name} konnte nicht gelesen werden: Datei ist beschädigt oder hat ein ungültiges Format.`,
    )
  }

  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw validationError(`${descriptor.name} enthält kein Tabellenblatt.`)
  }

  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    header: 1,
    raw: false,
    defval: '',
  }) as unknown[][]
}

export function findHeaderRow(
  descriptor: ImportTypeDescriptor,
  rows: unknown[][],
): SpreadsheetHeader {
  const requiredKeys = descriptor.requiredColumns.map((column) =>
    column.toLowerCase(),
  )

  for (let i = 0; i < rows.length; i += 1) {
    const normalized = (rows[i] ?? []).map(
      (cell) => normalizeText(cell)?.toLowerCase() ?? '',
    )

    const hasAllRequired = requiredKeys.every((key) => normalized.includes(key))
    if (!hasAllRequired) continue

    const headerMap: Record<string, number[]> = {}
    normalized.forEach((key, index) => {
      ;(headerMap[key] ??= []).push(index)
    })

    return { headerRowIndex: i, headerMap }
  }

  throw validationError(
    `${descriptor.name} konnte nicht gelesen werden: Kopfzeile nicht gefunden.`,
  )
}

export function firstIndex(
  headerMap: Record<string, number[]>,
  key: string,
): number | undefined {
  return headerMap[key]?.[0]
}

/**
 * Lookup for columns listed in requiredColumns — findHeaderRow guarantees
 * they exist in the header row.
 */
export function requiredIndex(
  headerMap: Record<string, number[]>,
  key: string,
): number {
  return firstIndex(headerMap, key)!
}

export function pickOptional<T>(
  stringRow: string[],
  index: number | undefined,
  transform: (value: string) => T | null,
): T | null {
  if (index === undefined) return null
  return transform(stringRow[index] ?? '')
}

function normalizeStringRow(row: unknown[]): string[] {
  return row.map((cell) => normalizeText(cell) ?? '')
}

function isBlankRow(stringRow: string[]): boolean {
  return stringRow.every((value) => value.length === 0)
}

/**
 * Walks the data rows below the header: blank rows are skipped silently,
 * rows the builder rejects produce a German skip warning.
 */
export function collectDataRows(
  rows: unknown[][],
  headerRowIndex: number,
  buildRow: (stringRow: string[]) => NormalizedBankTransactionInput | null,
): { rows: NormalizedBankTransactionInput[]; warnings: string[] } {
  const parsedRows: NormalizedBankTransactionInput[] = []
  const warnings: string[] = []

  rows.slice(headerRowIndex + 1).forEach((row, offset) => {
    const stringRow = normalizeStringRow(row ?? [])
    if (isBlankRow(stringRow)) return

    const parsed = buildRow(stringRow)
    if (parsed) {
      parsedRows.push(parsed)
      return
    }
    const lineNumber = headerRowIndex + offset + 2
    warnings.push(
      `Zeile ${lineNumber} konnte nicht importiert werden und wurde übersprungen.`,
    )
  })

  return { rows: parsedRows, warnings }
}
