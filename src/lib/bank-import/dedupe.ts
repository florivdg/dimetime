import type { NormalizedBankTransactionInput } from '@/lib/bank-import/types'
import { normalizeText } from '@/lib/bank-import/normalize'

export interface RowWithDedupeKey extends NormalizedBankTransactionInput {
  dedupeKey: string
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return toHex(hash)
}

function canonicalize(value: string | null | undefined): string {
  return (normalizeText(value) ?? '').toLowerCase()
}

function buildFallbackCanonicalInput(
  row: NormalizedBankTransactionInput,
): string {
  const parts = [
    row.bookingDate,
    row.valueDate ?? '',
    String(row.amountCents),
    row.currency,
    String(row.balanceAfterCents ?? ''),
    row.balanceCurrency ?? '',
    canonicalize(row.counterparty),
    canonicalize(row.bookingText),
    canonicalize(row.description),
    canonicalize(row.purpose),
    canonicalize(row.country),
    canonicalize(row.cardLast4),
    canonicalize(row.cardholder),
  ]

  return parts.join('|')
}

export async function buildDedupeKey(
  row: NormalizedBankTransactionInput,
): Promise<string> {
  const externalId = normalizeText(row.externalTransactionId)
  if (externalId) {
    return sha256(`external:${externalId.toLowerCase()}`)
  }

  return sha256(buildFallbackCanonicalInput(row))
}

export async function dedupeRowsInFile(
  rows: NormalizedBankTransactionInput[],
): Promise<{ uniqueRows: RowWithDedupeKey[]; duplicateInFile: number }> {
  const dedupeKeys = await Promise.all(rows.map((row) => buildDedupeKey(row)))
  const seen = new Set<string>()
  const uniqueRows: RowWithDedupeKey[] = []
  let duplicateInFile = 0

  rows.forEach((row, index) => {
    const dedupeKey = dedupeKeys[index]
    if (seen.has(dedupeKey)) {
      duplicateInFile += 1
      return
    }

    seen.add(dedupeKey)
    uniqueRows.push({
      ...row,
      dedupeKey,
    })
  })

  return { uniqueRows, duplicateInFile }
}

export async function hashFileSha256(bytes: Uint8Array): Promise<string> {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(arrayBuffer).set(bytes)
  const hash = await crypto.subtle.digest('SHA-256', arrayBuffer)
  return toHex(hash)
}
