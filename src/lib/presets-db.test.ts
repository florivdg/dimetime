import { beforeEach, describe, expect, it } from 'bun:test'
import {
  seedCategory,
  seedPlan as seedPlanRow,
  seedTransactionPreset,
  seedUser,
} from '@/lib/__fixtures__/seeds'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'

const testDb = setupTestDb()

const {
  applyMultiplePresetsToPlan,
  applyPresetToPlan,
  createPreset,
  deletePreset,
  getPresetById,
  getPresets,
  getPresetsByIds,
  getPresetsWithMatchStatus,
  updatePreset,
} = await import('./presets')

const userId = 'user-1'
const otherUserId = 'user-2'
const planId = 'plan-1'
const archivedPlanId = 'plan-archived'

async function seedUsers() {
  await seedUser(testDb, { id: userId, name: 'A', email: 'a@example.com' })
  await seedUser(testDb, { id: otherUserId, name: 'B', email: 'b@example.com' })
}

async function seedPlan(id = planId, isArchived = false) {
  await seedPlanRow(testDb, { id, name: id, isArchived })
}

async function insertCategory(id = 'cat-1', name = 'Cat') {
  await seedCategory(testDb, { id, name, slug: id })
}

async function insertPreset(
  id: string,
  overrides: Parameters<typeof seedTransactionPreset>[1] = {},
) {
  await seedTransactionPreset(testDb, {
    id,
    name: id,
    recurrence: 'monatlich',
    startMonth: '2026-01',
    userId,
    isBudget: false,
    ...overrides,
  })
}

beforeEach(async () => {
  await seedUsers()
  await seedPlan()
  await seedPlan(archivedPlanId, true)
})

describe('createPreset', () => {
  it('persists with defaults (startMonth = current month, isBudget=false, type=expense)', async () => {
    const created = await createPreset(userId, {
      name: 'Rent',
      amount: 50000,
    })
    expect(created.name).toBe('Rent')
    expect(created.type).toBe('expense')
    expect(created.recurrence).toBe('einmalig')
    expect(created.isBudget).toBe(false)
    const today = new Date()
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    expect(created.startMonth).toBe(ym)
  })

  it('honors all provided fields', async () => {
    await insertCategory()
    const created = await createPreset(userId, {
      name: 'Power',
      amount: 8000,
      type: 'expense',
      recurrence: 'jährlich',
      startMonth: '2026-03',
      endDate: '2027-12-31',
      categoryId: 'cat-1',
      dayOfMonth: 15,
      isBudget: true,
      note: 'memo',
    })
    expect(created.recurrence).toBe('jährlich')
    expect(created.startMonth).toBe('2026-03')
    expect(created.endDate).toBe('2027-12-31')
    expect(created.dayOfMonth).toBe(15)
    expect(created.isBudget).toBe(true)
    expect(created.note).toBe('memo')
    expect(created.categoryId).toBe('cat-1')
  })
})

describe('getPresetById', () => {
  it('returns the preset enriched with category fields', async () => {
    await insertCategory('cat-x', 'X')
    await insertPreset('p-1', { categoryId: 'cat-x' })
    const preset = await getPresetById('p-1')
    expect(preset?.id).toBe('p-1')
    expect(preset?.categoryName).toBe('X')
  })

  it('returns undefined for unknown id', async () => {
    expect(await getPresetById('missing')).toBeUndefined()
  })
})

describe('getPresetsByIds', () => {
  it('returns empty list for empty input', async () => {
    expect(await getPresetsByIds([])).toEqual([])
  })

  it('returns id + userId for matched ids', async () => {
    await insertPreset('p-1')
    await insertPreset('p-2', { userId: otherUserId })
    const result = await getPresetsByIds(['p-1', 'p-2', 'missing'])
    expect(result).toHaveLength(2)
    expect(result.find((r) => r.id === 'p-1')?.userId).toBe(userId)
    expect(result.find((r) => r.id === 'p-2')?.userId).toBe(otherUserId)
  })
})

describe('getPresets', () => {
  beforeEach(async () => {
    await insertCategory('cat-a', 'Alpha')
    await insertCategory('cat-b', 'Beta')
    await insertPreset('p-1', {
      name: 'Apple',
      type: 'expense',
      amount: 1000,
      categoryId: 'cat-a',
      recurrence: 'monatlich',
    })
    await insertPreset('p-2', {
      name: 'Banana',
      type: 'income',
      amount: 5000,
      categoryId: 'cat-b',
      recurrence: 'einmalig',
    })
    await insertPreset('p-3', {
      name: 'Cherry',
      type: 'expense',
      amount: 200,
      recurrence: 'jährlich',
      endDate: '2025-12-31',
    })
  })

  it('returns all presets for the user (default sort = createdAt desc)', async () => {
    const { presets, pagination } = await getPresets(userId)
    expect(presets).toHaveLength(3)
    expect(pagination.total).toBe(3)
  })

  it('filters by search', async () => {
    const { presets } = await getPresets(userId, { search: 'App' })
    expect(presets.map((p) => p.id)).toEqual(['p-1'])
  })

  it('filters by type', async () => {
    const { presets } = await getPresets(userId, { type: 'income' })
    expect(presets.map((p) => p.id)).toEqual(['p-2'])
  })

  it('filters by categoryId', async () => {
    const { presets } = await getPresets(userId, { categoryId: 'cat-a' })
    expect(presets.map((p) => p.id)).toEqual(['p-1'])
  })

  it('filters by recurrence', async () => {
    const { presets } = await getPresets(userId, { recurrence: 'einmalig' })
    expect(presets.map((p) => p.id)).toEqual(['p-2'])
  })

  it('hides expired when includeExpired=false', async () => {
    const { presets } = await getPresets(userId, { includeExpired: false })
    expect(presets.map((p) => p.id)).not.toContain('p-3')
  })

  it('sorts by name ascending', async () => {
    const { presets } = await getPresets(userId, {
      sortBy: 'name',
      sortDir: 'asc',
    })
    expect(presets.map((p) => p.name)).toEqual(['Apple', 'Banana', 'Cherry'])
  })

  it('sorts by amount descending', async () => {
    const { presets } = await getPresets(userId, {
      sortBy: 'amount',
      sortDir: 'desc',
    })
    expect(presets[0].amount).toBe(5000)
  })

  it('paginates results', async () => {
    const { presets, pagination } = await getPresets(userId, {
      limit: 1,
      page: 2,
    })
    expect(presets).toHaveLength(1)
    expect(pagination.totalPages).toBe(3)
  })

  it('returns all results when limit=-1', async () => {
    const { presets, pagination } = await getPresets(userId, { limit: -1 })
    expect(presets).toHaveLength(3)
    expect(pagination.totalPages).toBe(1)
  })

  it('scopes to a single user', async () => {
    await insertPreset('p-other', { userId: otherUserId, name: 'Other' })
    const { presets } = await getPresets(userId)
    expect(presets.map((p) => p.id)).not.toContain('p-other')
  })
})

describe('updatePreset', () => {
  it('updates only the provided fields', async () => {
    await insertPreset('p-1', { name: 'Old', note: 'keep' })
    const updated = await updatePreset('p-1', { name: 'New' })
    expect(updated?.name).toBe('New')
    expect(updated?.note).toBe('keep')
  })

  it('returns undefined for unknown id', async () => {
    expect(await updatePreset('missing', { name: 'x' })).toBeUndefined()
  })
})

describe('deletePreset', () => {
  it('returns true when deleting an existing preset', async () => {
    await insertPreset('p-1')
    expect(await deletePreset('p-1')).toBe(true)
    expect(await getPresetById('p-1')).toBeUndefined()
  })

  it('returns false when nothing to delete', async () => {
    expect(await deletePreset('missing')).toBe(false)
  })
})

describe('applyPresetToPlan', () => {
  it('throws when preset is missing', async () => {
    expect(applyPresetToPlan('missing', { planId })).rejects.toThrow(
      'Preset nicht gefunden',
    )
  })

  it('throws when plan is missing', async () => {
    await insertPreset('p-1')
    expect(applyPresetToPlan('p-1', { planId: 'missing' })).rejects.toThrow(
      'Plan nicht gefunden',
    )
  })

  it('throws when plan is archived', async () => {
    await insertPreset('p-1')
    expect(
      applyPresetToPlan('p-1', { planId: archivedPlanId }),
    ).rejects.toThrow('Plan ist archiviert')
  })

  it('creates a transaction with preset fields and updates lastUsedAt', async () => {
    await insertPreset('p-1', {
      name: 'Strom',
      type: 'expense',
      amount: 8000,
      isBudget: true,
    })
    const tx = await applyPresetToPlan('p-1', { planId })
    expect(tx.name).toBe('Strom')
    expect(tx.type).toBe('expense')
    expect(tx.amount).toBe(8000)
    expect(tx.isBudget).toBe(true)
    expect(tx.planId).toBe(planId)

    const refreshed = await getPresetById('p-1')
    expect(refreshed?.lastUsedAt).toBeInstanceOf(Date)
  })

  it('honors dueDate override', async () => {
    await insertPreset('p-1')
    const tx = await applyPresetToPlan('p-1', {
      planId,
      dueDate: '2026-03-25',
    })
    expect(tx.dueDate).toBe('2026-03-25')
  })

  it('clamps dayOfMonth to last day of month when too high', async () => {
    await insertPreset('p-1', { dayOfMonth: 31 })
    // plan is 2026-03-01 (March has 31 days, so no clamp)
    let tx = await applyPresetToPlan('p-1', { planId })
    expect(tx.dueDate).toBe('2026-03-31')

    // Use a different plan in February
    await seedPlanRow(testDb, { id: 'plan-feb', date: '2026-02-01' })
    tx = await applyPresetToPlan('p-1', { planId: 'plan-feb' })
    expect(tx.dueDate).toBe('2026-02-28')
  })

  it('falls back to plan.date when dayOfMonth is null', async () => {
    await insertPreset('p-1')
    const tx = await applyPresetToPlan('p-1', { planId })
    expect(tx.dueDate).toBe('2026-03-01')
  })
})

describe('applyMultiplePresetsToPlan', () => {
  it('returns count of successfully applied presets', async () => {
    await insertPreset('p-1')
    await insertPreset('p-2', { name: 'B' })
    const result = await applyMultiplePresetsToPlan(['p-1', 'p-2'], { planId })
    expect(result.count).toBe(2)
    expect(result.transactions).toHaveLength(2)
  })

  it('continues on per-preset failure', async () => {
    await insertPreset('p-1')
    const result = await applyMultiplePresetsToPlan(['p-1', 'missing'], {
      planId,
    })
    expect(result.count).toBe(1)
  })
})

describe('getPresetsWithMatchStatus', () => {
  it('includes a boolean isMatching per preset for the given plan month', async () => {
    await insertPreset('match', {
      recurrence: 'monatlich',
      startMonth: '2026-01',
    })
    await insertPreset('no-match', {
      recurrence: 'einmalig',
      startMonth: '2027-01',
    })
    const result = await getPresetsWithMatchStatus(userId, '2026-03')
    const matched = result.find((p) => p.id === 'match')
    const unmatched = result.find((p) => p.id === 'no-match')
    expect(matched?.isMatching).toBe(true)
    expect(unmatched?.isMatching).toBe(false)
  })
})
