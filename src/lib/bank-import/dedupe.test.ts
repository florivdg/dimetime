import { describe, expect, it } from 'bun:test'
import { buildDedupeKey, dedupeRowsInFile } from './dedupe'
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
