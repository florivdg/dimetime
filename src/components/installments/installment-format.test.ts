import { describe, expect, it } from 'bun:test'
import {
  formatMonthNumeric,
  formatMonthShort,
  monthToDate,
} from './installment-format'

describe('monthToDate', () => {
  it('returns the first day of the month in local time', () => {
    const date = monthToDate('2026-09')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(8)
    expect(date.getDate()).toBe(1)
  })
})

describe('formatMonthNumeric', () => {
  it('formats a month key as MM/JJJJ', () => {
    expect(formatMonthNumeric('2027-03')).toBe('03/2027')
  })
})

describe('formatMonthShort', () => {
  it('formats a date as a short German month with a 2-digit year', () => {
    expect(formatMonthShort(new Date(2026, 8, 1))).toContain('26')
  })
})
