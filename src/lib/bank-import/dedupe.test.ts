import { describe, expect, it } from 'bun:test'
import { buildDedupeKey } from './dedupe-key'
import {
  buildSemanticKey,
  dedupeByStatusUpgrade,
  dedupeRowsInFile,
} from './dedupe'
import type { NormalizedBankTransactionInput } from './types'

function makeRow(
  overrides: Partial<NormalizedBankTransactionInput> = {},
): NormalizedBankTransactionInput {
  return {
    externalTransactionId: null,
    bookingDate: '2024-01-15',
    valueDate: null,
    amountCents: -2000,
    currency: 'EUR',
    originalAmountCents: null,
    originalCurrency: null,
    counterparty: 'Test GmbH',
    bookingText: 'Lastschrift',
    description: null,
    purpose: 'Rechnung 123',
    status: 'booked',
    balanceAfterCents: null,
    balanceCurrency: null,
    country: null,
    cardLast4: null,
    cardholder: null,
    rawData: {},
    ...overrides,
  }
}

describe('buildDedupeKey', () => {
  it('uses external ID path when externalTransactionId is present', async () => {
    const key = await buildDedupeKey(
      makeRow({ externalTransactionId: 'EXT-001' }),
    )
    expect(key).toBeTypeOf('string')
    expect(key.length).toBe(64) // SHA-256 hex

    // Same external ID produces same key
    const key2 = await buildDedupeKey(
      makeRow({
        externalTransactionId: 'EXT-001',
        amountCents: -9999, // different amount should not matter
      }),
    )
    expect(key).toBe(key2)
  })

  it('uses fallback path when externalTransactionId is null', async () => {
    const key = await buildDedupeKey(makeRow())
    expect(key).toBeTypeOf('string')
    expect(key.length).toBe(64)
  })

  it('produces deterministic output', async () => {
    const row = makeRow()
    const key1 = await buildDedupeKey(row)
    const key2 = await buildDedupeKey(row)
    expect(key1).toBe(key2)
  })

  it('produces different keys for different inputs', async () => {
    const key1 = await buildDedupeKey(makeRow({ amountCents: -1000 }))
    const key2 = await buildDedupeKey(makeRow({ amountCents: -2000 }))
    expect(key1).not.toBe(key2)
  })
})

describe('dedupeRowsInFile', () => {
  it('returns all rows when no duplicates exist', async () => {
    const rows = [
      makeRow({ bookingDate: '2024-01-01', amountCents: -100 }),
      makeRow({ bookingDate: '2024-01-02', amountCents: -200 }),
    ]
    const { uniqueRows, duplicateInFile } = await dedupeRowsInFile(rows)
    expect(uniqueRows).toHaveLength(2)
    expect(duplicateInFile).toBe(0)
  })

  it('removes duplicates and counts them', async () => {
    const row = makeRow({ externalTransactionId: 'SAME-ID' })
    const { uniqueRows, duplicateInFile } = await dedupeRowsInFile([
      row,
      row,
      row,
    ])
    expect(uniqueRows).toHaveLength(1)
    expect(duplicateInFile).toBe(2)
  })

  it('handles empty input', async () => {
    const { uniqueRows, duplicateInFile } = await dedupeRowsInFile([])
    expect(uniqueRows).toHaveLength(0)
    expect(duplicateInFile).toBe(0)
  })

  it('preserves first occurrence and adds dedupeKey', async () => {
    const first = makeRow({
      externalTransactionId: 'DUP',
      counterparty: 'First',
    })
    const second = makeRow({
      externalTransactionId: 'DUP',
      counterparty: 'Second',
    })
    const { uniqueRows } = await dedupeRowsInFile([first, second])
    expect(uniqueRows).toHaveLength(1)
    expect(uniqueRows[0].counterparty).toBe('First')
    expect(uniqueRows[0].dedupeKey).toBeTypeOf('string')
  })
})

describe('buildSemanticKey', () => {
  it('produces deterministic output', () => {
    const row = makeRow()
    expect(buildSemanticKey(row)).toBe(buildSemanticKey(row))
  })

  it('is case-insensitive for description', () => {
    const lower = makeRow({ description: 'test payment' })
    const upper = makeRow({ description: 'TEST PAYMENT' })
    expect(buildSemanticKey(lower)).toBe(buildSemanticKey(upper))
  })

  it('handles null description', () => {
    const row = makeRow({ description: null })
    const key = buildSemanticKey(row)
    expect(key).toBeTypeOf('string')
    expect(key).toContain('2024-01-15|-2000|')
  })
})

describe('dedupeByStatusUpgrade', () => {
  it('returns all rows when only booked rows exist', () => {
    const rows = [
      makeRow({ status: 'booked', externalTransactionId: 'B1' }),
      makeRow({
        status: 'booked',
        externalTransactionId: 'B2',
        amountCents: -500,
      }),
    ]
    const result = dedupeByStatusUpgrade(rows)
    expect(result.rows).toHaveLength(2)
    expect(result.pendingDropped).toBe(0)
  })

  it('returns all rows when only pending rows exist', () => {
    const rows = [
      makeRow({ status: 'pending', externalTransactionId: 'P1' }),
      makeRow({
        status: 'pending',
        externalTransactionId: 'P2',
        amountCents: -500,
      }),
    ]
    const result = dedupeByStatusUpgrade(rows)
    expect(result.rows).toHaveLength(2)
    expect(result.pendingDropped).toBe(0)
  })

  it('removes pending when matching booked exists (single pair)', () => {
    const rows = [
      makeRow({
        status: 'pending',
        externalTransactionId: 'P1',
        description: 'Amazon',
      }),
      makeRow({
        status: 'booked',
        externalTransactionId: 'B1',
        description: 'Amazon',
      }),
    ]
    const result = dedupeByStatusUpgrade(rows)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].status).toBe('booked')
    expect(result.pendingDropped).toBe(1)
  })

  it('removes all pending when multiple pairs match', () => {
    const rows = [
      makeRow({
        status: 'pending',
        externalTransactionId: 'P1',
        description: 'Amazon',
      }),
      makeRow({
        status: 'pending',
        externalTransactionId: 'P2',
        description: 'Netflix',
        amountCents: -1500,
      }),
      makeRow({
        status: 'booked',
        externalTransactionId: 'B1',
        description: 'Amazon',
      }),
      makeRow({
        status: 'booked',
        externalTransactionId: 'B2',
        description: 'Netflix',
        amountCents: -1500,
      }),
    ]
    const result = dedupeByStatusUpgrade(rows)
    expect(result.rows).toHaveLength(2)
    expect(result.rows.every((r) => r.status === 'booked')).toBe(true)
    expect(result.pendingDropped).toBe(2)
  })

  it('removes only one pending per matching booked (partial overlap)', () => {
    const rows = [
      makeRow({
        status: 'pending',
        externalTransactionId: 'P1',
        description: 'Amazon',
      }),
      makeRow({
        status: 'pending',
        externalTransactionId: 'P2',
        description: 'Amazon',
      }),
      makeRow({
        status: 'booked',
        externalTransactionId: 'B1',
        description: 'Amazon',
      }),
    ]
    const result = dedupeByStatusUpgrade(rows)
    expect(result.rows).toHaveLength(2)
    expect(result.rows.filter((r) => r.status === 'pending')).toHaveLength(1)
    expect(result.rows.filter((r) => r.status === 'booked')).toHaveLength(1)
    expect(result.pendingDropped).toBe(1)
  })

  it('keeps both when description differs', () => {
    const rows = [
      makeRow({
        status: 'pending',
        externalTransactionId: 'P1',
        description: 'Amazon',
      }),
      makeRow({
        status: 'booked',
        externalTransactionId: 'B1',
        description: 'Netflix',
      }),
    ]
    const result = dedupeByStatusUpgrade(rows)
    expect(result.rows).toHaveLength(2)
    expect(result.pendingDropped).toBe(0)
  })

  it('keeps both when amount differs', () => {
    const rows = [
      makeRow({
        status: 'pending',
        externalTransactionId: 'P1',
        amountCents: -1000,
      }),
      makeRow({
        status: 'booked',
        externalTransactionId: 'B1',
        amountCents: -2000,
      }),
    ]
    const result = dedupeByStatusUpgrade(rows)
    expect(result.rows).toHaveLength(2)
    expect(result.pendingDropped).toBe(0)
  })
})
