import { describe, expect, it } from 'bun:test'
import {
  formatAmount,
  formatDate,
  formatDateTime,
  formatRecurrence,
  getMonthPacing,
  getPlanDisplayName,
  truncateText,
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

describe('formatDateTime', () => {
  it('combines date + time with defaults', () => {
    const result = formatDateTime('2024-03-15T14:30:00Z')
    expect(result).toContain('2024')
    // hour digits present (depending on locale rendering)
    expect(result).toMatch(/\d{1,2}/)
  })

  it('honors custom dateStyle and timeStyle', () => {
    const short = formatDateTime('2024-03-15T14:30:00Z', 'short', 'short')
    const long = formatDateTime('2024-03-15T14:30:00Z', 'long', 'long')
    expect(long.length).toBeGreaterThan(short.length)
  })
})

describe('truncateText', () => {
  it('returns empty string for null', () => {
    expect(truncateText(null)).toBe('')
  })

  it('returns text unchanged when within limit', () => {
    expect(truncateText('short', 10)).toBe('short')
  })

  it('truncates and appends ellipsis when over limit', () => {
    expect(truncateText('abcdefghij', 5)).toBe('abcde…')
  })

  it('uses default maxLength of 100', () => {
    const text = 'a'.repeat(150)
    const result = truncateText(text)
    expect(result.length).toBe(101)
    expect(result.endsWith('…')).toBe(true)
  })
})

describe('getMonthPacing', () => {
  it('reports 0% elapsed when plan month is in the future', () => {
    const result = getMonthPacing('2030-12-01', new Date('2026-05-15'))
    expect(result.isCurrent).toBe(false)
    expect(result.daysElapsed).toBe(0)
    expect(result.totalDays).toBe(31)
    expect(result.percentElapsed).toBe(0)
  })

  it('reports 100% elapsed when plan month is in the past', () => {
    const result = getMonthPacing('2020-02-01', new Date('2026-05-15'))
    expect(result.isCurrent).toBe(false)
    expect(result.daysElapsed).toBe(29) // 2020 is a leap year
    expect(result.totalDays).toBe(29)
    expect(result.percentElapsed).toBe(100)
  })

  it('reports today.getDate() elapsed when plan month is current', () => {
    const today = new Date(2026, 4, 10) // May 10, 2026 (local time)
    const result = getMonthPacing('2026-05-01', today)
    expect(result.isCurrent).toBe(true)
    expect(result.daysElapsed).toBe(10)
    expect(result.totalDays).toBe(31)
  })

  it('treats past year as fully elapsed', () => {
    const result = getMonthPacing('2020-06-15', new Date('2026-01-01'))
    expect(result.isCurrent).toBe(false)
    expect(result.daysElapsed).toBe(30)
  })
})

describe('formatRecurrence', () => {
  it('formats all German recurrence types', () => {
    expect(formatRecurrence('einmalig')).toBe('Einmalig')
    expect(formatRecurrence('monatlich')).toBe('Monatlich')
    expect(formatRecurrence('vierteljährlich')).toBe('Vierteljährlich')
    expect(formatRecurrence('halbjährlich')).toBe('Halbjährlich')
    expect(formatRecurrence('jährlich')).toBe('Jährlich')
  })

  it('returns input as fallback for unknown values', () => {
    expect(formatRecurrence('weekly')).toBe('weekly')
  })
})
