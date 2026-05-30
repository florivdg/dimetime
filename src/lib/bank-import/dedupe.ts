import type { NormalizedBankTransactionInput } from '@/lib/bank-import/types'
import { normalizeText } from '@/lib/bank-import/normalize'
import { buildDedupeKey } from './dedupe-key'

export { hashFileSha256 } from './dedupe-key'

export interface RowWithDedupeKey extends NormalizedBankTransactionInput {
  dedupeKey: string
}

function canonicalize(value: string | null | undefined): string {
  return (normalizeText(value) ?? '').toLowerCase()
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

export function buildSemanticKey(row: {
  bookingDate: string
  amountCents: number
  description: string | null | undefined
}): string {
  return `${row.bookingDate}|${row.amountCents}|${canonicalize(row.description)}`
}

export function dedupeByStatusUpgrade(rows: NormalizedBankTransactionInput[]): {
  rows: NormalizedBankTransactionInput[]
  pendingDropped: number
} {
  // Group rows by semantic key
  const groups = new Map<string, NormalizedBankTransactionInput[]>()
  for (const row of rows) {
    const key = buildSemanticKey(row)
    const group = groups.get(key)
    if (group) {
      group.push(row)
    } else {
      groups.set(key, [row])
    }
  }

  const removedIndices = new Set<number>()
  let pendingDropped = 0

  for (const group of groups.values()) {
    const bookedRows = group.filter((r) => r.status === 'booked')
    const pendingRows = group.filter((r) => r.status === 'pending')

    // One-for-one: remove one pending per matching booked
    const removals = Math.min(bookedRows.length, pendingRows.length)
    for (let i = 0; i < removals; i++) {
      const pendingRow = pendingRows[i]
      const idx = rows.indexOf(pendingRow)
      if (idx !== -1) {
        removedIndices.add(idx)
        pendingDropped++
      }
    }
  }

  if (pendingDropped === 0) {
    return { rows, pendingDropped: 0 }
  }

  const filtered = rows.filter((_, i) => !removedIndices.has(i))
  return { rows: filtered, pendingDropped }
}
