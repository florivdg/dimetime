import { describe, expect, it } from 'bun:test'
import { adjustDueDateToMonth } from './transactions'

describe('adjustDueDateToMonth', () => {
  it('preserves day when valid in target month', () => {
    expect(adjustDueDateToMonth('2024-01-15', '2024-03-01')).toBe('2024-03-15')
  })

  it('clamps to 28 for February in non-leap year', () => {
    expect(adjustDueDateToMonth('2024-01-31', '2023-02-01')).toBe('2023-02-28')
  })

  it('clamps to 29 for February in leap year', () => {
    expect(adjustDueDateToMonth('2024-01-31', '2024-02-01')).toBe('2024-02-29')
  })

  it('clamps to 30 for months with 30 days', () => {
    expect(adjustDueDateToMonth('2024-01-31', '2024-04-01')).toBe('2024-04-30')
    expect(adjustDueDateToMonth('2024-01-31', '2024-06-01')).toBe('2024-06-30')
    expect(adjustDueDateToMonth('2024-01-31', '2024-09-01')).toBe('2024-09-30')
    expect(adjustDueDateToMonth('2024-01-31', '2024-11-01')).toBe('2024-11-30')
  })

  it('handles year boundary', () => {
    expect(adjustDueDateToMonth('2024-12-25', '2025-01-01')).toBe('2025-01-25')
  })

  it('preserves day 1', () => {
    expect(adjustDueDateToMonth('2024-03-01', '2024-06-01')).toBe('2024-06-01')
  })
})
