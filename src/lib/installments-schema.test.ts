import { describe, expect, it } from 'bun:test'
import {
  createInstallmentSchema,
  FINAL_AMOUNT_MESSAGE,
  PREPAID_MESSAGE,
  updateInstallmentSchema,
} from './installments-schema'

const validInput = {
  name: 'Sofa',
  amount: 5000,
  totalInstallments: 12,
  startMonth: '2026-03',
}

/** First message the schema complains about, `null` when the input passes. */
function firstIssue(input: unknown): string | null {
  const parsed = createInstallmentSchema.safeParse(input)
  return parsed.success ? null : parsed.error.issues[0].message
}

describe('createInstallmentSchema', () => {
  it('accepts a minimal valid payload', () => {
    expect(firstIssue(validInput)).toBeNull()
  })

  it('accepts the nullable optional fields', () => {
    expect(
      firstIssue({
        ...validInput,
        note: null,
        dayOfMonth: null,
        categoryId: null,
        finalAmount: null,
      }),
    ).toBeNull()
  })

  it('rejects a blank name', () => {
    expect(firstIssue({ ...validInput, name: '' })).toBe(
      'Name ist erforderlich',
    )
  })

  it('rejects an amount of zero', () => {
    expect(firstIssue({ ...validInput, amount: 0 })).toBe(
      'Betrag muss größer als 0 sein',
    )
  })

  it('rejects a non-numeric amount in German', () => {
    expect(firstIssue({ ...validInput, amount: Number.NaN })).toBe(
      'Betrag muss eine Zahl sein',
    )
    expect(firstIssue({ ...validInput, totalInstallments: '' })).toBe(
      'Anzahl der Raten muss eine Zahl sein',
    )
  })

  it('rejects a month that does not exist', () => {
    for (const startMonth of ['2026-00', '2026-13', '2026-03-01', '26-03']) {
      expect(firstIssue({ ...validInput, startMonth })).toBe(
        'Ungültiges Monatsformat (erwartet: JJJJ-MM)',
      )
    }
  })

  it('rejects a day outside 1-31', () => {
    for (const dayOfMonth of [0, 32]) {
      expect(firstIssue({ ...validInput, dayOfMonth })).toBe(
        'Tag muss zwischen 1 und 31 liegen',
      )
    }
  })

  it('accepts a differing final rate', () => {
    expect(firstIssue({ ...validInput, finalAmount: 4735 })).toBeNull()
  })

  it('rejects a final rate that is not a positive integer', () => {
    expect(firstIssue({ ...validInput, finalAmount: 0 })).toBe(
      'Schlussrate muss größer als 0 sein',
    )
    expect(firstIssue({ ...validInput, finalAmount: 47.35 })).toBe(
      'Schlussrate muss eine ganze Zahl sein',
    )
  })

  it('rejects a final rate on a single-installment plan', () => {
    expect(
      firstIssue({ ...validInput, totalInstallments: 1, finalAmount: 4735 }),
    ).toBe(FINAL_AMOUNT_MESSAGE)
    expect(
      firstIssue({ ...validInput, totalInstallments: 1, finalAmount: null }),
    ).toBeNull()
  })

  it('rejects more prepaid than total installments', () => {
    expect(firstIssue({ ...validInput, prepaidInstallments: 13 })).toBe(
      PREPAID_MESSAGE,
    )
    expect(firstIssue({ ...validInput, prepaidInstallments: 12 })).toBeNull()
  })
})

describe('updateInstallmentSchema', () => {
  it('accepts an empty body', () => {
    expect(updateInstallmentSchema.safeParse({}).success).toBe(true)
  })

  it('keeps the field-level rules', () => {
    const parsed = updateInstallmentSchema.safeParse({ startMonth: '2026-13' })
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0].message).toBe(
      'Ungültiges Monatsformat (erwartet: JJJJ-MM)',
    )
  })

  it('leaves the prepaid/total comparison to the route', () => {
    // A partial body may carry only one of the two, so the merged check lives
    // in PUT /api/installments/[id] against the stored row
    const parsed = updateInstallmentSchema.safeParse({
      totalInstallments: 3,
      prepaidInstallments: 5,
    })
    expect(parsed.success).toBe(true)
  })

  it('leaves the final rate / total comparison to the route', () => {
    const parsed = updateInstallmentSchema.safeParse({
      totalInstallments: 1,
      finalAmount: 4735,
    })
    expect(parsed.success).toBe(true)
  })
})
