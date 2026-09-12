import type { Plan } from '@/lib/plans'
import type { PresetWithTags } from '@/lib/presets'

export function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1',
    name: 'September',
    date: '2026-09-01',
    notes: null,
    isArchived: false,
    createdAt: new Date('2026-09-01T12:00:00Z'),
    updatedAt: new Date('2026-09-01T12:00:00Z'),
    ...overrides,
  }
}

export function makePreset(
  overrides: Partial<PresetWithTags> = {},
): PresetWithTags {
  return {
    id: 'preset-1',
    name: 'Miete',
    note: null,
    amount: 123456,
    type: 'expense',
    recurrence: 'monatlich',
    startMonth: '2026-01',
    endDate: null,
    categoryId: null,
    dayOfMonth: null,
    isBudget: false,
    userId: 'creator-1',
    lastUsedAt: null,
    createdAt: new Date('2026-01-01T12:00:00Z'),
    updatedAt: new Date('2026-01-01T12:00:00Z'),
    categoryName: null,
    categoryColor: null,
    ...overrides,
  }
}
