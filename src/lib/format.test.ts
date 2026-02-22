import { describe, expect, it } from 'bun:test'
import {
  formatAmount,
  formatDate,
  getPlanDisplayName,
  formatRecurrence,
} from './format'

/** Normalize whitespace (Intl may produce non-breaking spaces U+00A0) */
function norm(s: string): string {
  return s.replace(/\u00a0/g, ' ')
}

describe('formatAmount', () => {
  it('formats positive cents', () => {
    expect(norm(formatAmount(1234))).toContain('12,34')
    expect(norm(formatAmount(1234))).toContain('€')
  })

  it('formats negative cents', () => {
    const result = norm(formatAmount(-5000))
    expect(result).toContain('50,00')
    expect(result).toContain('€')
  })

  it('formats zero', () => {
    const result = norm(formatAmount(0))
    expect(result).toContain('0,00')
  })

  it('formats amounts with thousand separators', () => {
    const result = norm(formatAmount(123456))
    expect(result).toContain('1.234,56')
  })
})

describe('formatDate', () => {
  it('formats ISO date string', () => {
    const result = formatDate('2024-03-15')
    expect(result).toContain('2024')
    expect(result).toContain('15')
  })

  it('formats Date object', () => {
    const result = formatDate(new Date('2024-06-01T00:00:00Z'))
    expect(result).toContain('2024')
  })

  it('respects style parameter', () => {
    const short = formatDate('2024-03-15', 'short')
    const long = formatDate('2024-03-15', 'long')
    expect(long.length).toBeGreaterThan(short.length)
  })
})

describe('getPlanDisplayName', () => {
  it('returns name when present', () => {
    expect(getPlanDisplayName('Mein Plan', '2024-03-01')).toBe('Mein Plan')
  })

  it('returns month/year from date when name is null', () => {
    const result = getPlanDisplayName(null, '2024-03-01')
    expect(result).toContain('2024')
    expect(result.toLowerCase()).toContain('mär')
  })

  it('returns month/year from date when name is empty', () => {
    const result = getPlanDisplayName('', '2024-01-01')
    expect(result).toContain('2024')
  })

  it('returns dash when both are null', () => {
    expect(getPlanDisplayName(null, null)).toBe('-')
  })
})

describe('formatRecurrence', () => {
  it('formats all German recurrence types', () => {
    expect(formatRecurrence('einmalig')).toBe('Einmalig')
    expect(formatRecurrence('monatlich')).toBe('Monatlich')
    expect(formatRecurrence('vierteljährlich')).toBe('Vierteljährlich')
    expect(formatRecurrence('jährlich')).toBe('Jährlich')
  })

  it('returns input as fallback for unknown values', () => {
    expect(formatRecurrence('weekly')).toBe('weekly')
  })
})
