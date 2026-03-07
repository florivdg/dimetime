import { describe, expect, it } from 'bun:test'
import { presetMatchesPlanMonth, isPresetExpired } from './presets'
import type { TransactionPreset } from './presets'

function makePreset(
  overrides: Partial<TransactionPreset> = {},
): TransactionPreset {
  return {
    id: 'preset-1',
    name: 'Test Preset',
    note: null,
    type: 'expense',
    amount: 1000,
    recurrence: 'monatlich',
    startMonth: '2024-01',
    endDate: null,
    categoryId: null,
    dayOfMonth: null,
    isBudget: false,
    userId: 'user-1',
    lastUsedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

describe('presetMatchesPlanMonth', () => {
  it('einmalig matches only the start month', () => {
    const preset = makePreset({
      recurrence: 'einmalig',
      startMonth: '2024-03',
    })
    expect(presetMatchesPlanMonth(preset, '2024-03')).toBe(true)
    expect(presetMatchesPlanMonth(preset, '2024-04')).toBe(false)
    expect(presetMatchesPlanMonth(preset, '2024-02')).toBe(false)
  })

  it('monatlich matches any month >= start', () => {
    const preset = makePreset({
      recurrence: 'monatlich',
      startMonth: '2024-03',
    })
    expect(presetMatchesPlanMonth(preset, '2024-03')).toBe(true)
    expect(presetMatchesPlanMonth(preset, '2024-06')).toBe(true)
    expect(presetMatchesPlanMonth(preset, '2025-01')).toBe(true)
    expect(presetMatchesPlanMonth(preset, '2024-02')).toBe(false)
  })

  it('vierteljährlich matches every 3 months from start', () => {
    const preset = makePreset({
      recurrence: 'vierteljährlich',
      startMonth: '2024-01',
    })
    expect(presetMatchesPlanMonth(preset, '2024-01')).toBe(true)
    expect(presetMatchesPlanMonth(preset, '2024-04')).toBe(true)
    expect(presetMatchesPlanMonth(preset, '2024-07')).toBe(true)
    expect(presetMatchesPlanMonth(preset, '2024-10')).toBe(true)
    expect(presetMatchesPlanMonth(preset, '2024-02')).toBe(false)
    expect(presetMatchesPlanMonth(preset, '2024-03')).toBe(false)
  })

  it('jährlich matches same month each year', () => {
    const preset = makePreset({
      recurrence: 'jährlich',
      startMonth: '2024-06',
    })
    expect(presetMatchesPlanMonth(preset, '2024-06')).toBe(true)
    expect(presetMatchesPlanMonth(preset, '2025-06')).toBe(true)
    expect(presetMatchesPlanMonth(preset, '2026-06')).toBe(true)
    expect(presetMatchesPlanMonth(preset, '2024-07')).toBe(false)
    expect(presetMatchesPlanMonth(preset, '2025-01')).toBe(false)
  })

  it('respects endDate', () => {
    const preset = makePreset({
      recurrence: 'monatlich',
      startMonth: '2024-01',
      endDate: '2024-06-30',
    })
    expect(presetMatchesPlanMonth(preset, '2024-06')).toBe(true)
    expect(presetMatchesPlanMonth(preset, '2024-07')).toBe(false)
  })

  it('returns true for any month when startMonth is null', () => {
    const preset = makePreset({
      recurrence: 'monatlich',
      startMonth: null,
    })
    expect(presetMatchesPlanMonth(preset, '2020-01')).toBe(true)
    expect(presetMatchesPlanMonth(preset, '2030-12')).toBe(true)
  })

  it('returns false for unknown recurrence', () => {
    const preset = makePreset({
      recurrence: 'unknown' as any,
      startMonth: '2024-01',
    })
    expect(presetMatchesPlanMonth(preset, '2024-01')).toBe(false)
  })
})

describe('isPresetExpired', () => {
  it('returns false when endDate is null', () => {
    expect(isPresetExpired(makePreset({ endDate: null }))).toBe(false)
  })

  it('returns true for past endDate', () => {
    expect(isPresetExpired(makePreset({ endDate: '2020-01-01' }))).toBe(true)
  })

  it('returns false for future endDate', () => {
    expect(isPresetExpired(makePreset({ endDate: '2099-12-31' }))).toBe(false)
  })
})
