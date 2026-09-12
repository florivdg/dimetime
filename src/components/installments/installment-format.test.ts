import { describe, expect, it } from 'bun:test'
import {
  formatMonthNumeric,
  formatMonthShort,
  monthToDate,
  ratePercent,
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
    expect(formatMonthShort(new Date(2026, 8, 1))).toBe('Sept. 26')
  })
})

describe('ratePercent', () => {
  it('rounds the share of paid installments', () => {
    expect(ratePercent(5, 12)).toBe(42)
  })

  it('caps prepaid overshoot at 100', () => {
    expect(ratePercent(14, 12)).toBe(100)
  })

  it('returns 0 without any installment', () => {
    expect(ratePercent(0, 0)).toBe(0)
  })
})
