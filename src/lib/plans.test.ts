import { beforeEach, describe, expect, it } from 'bun:test'
import { seedPlan } from '@/lib/__fixtures__/seeds'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'

const testDb = setupTestDb()

const {
  createPlan,
  deletePlan,
  formatYearMonth,
  getActivePlan,
  getAllPlans,
  getAvailableYears,
  getCurrentMonthPlan,
  getNextUpcomingPlan,
  getPlanById,
  getSidebarPlans,
  searchPlans,
  updatePlan,
} = await import('./plans')

async function insertPlan(
  id: string,
  date: string,
  options: {
    name?: string | null
    isArchived?: boolean
    notes?: string | null
  } = {},
) {
  await seedPlan(testDb, {
    id,
    name: options.name ?? null,
    date,
    notes: options.notes ?? null,
    isArchived: options.isArchived ?? false,
  })
}

/** Month as `YYYY-MM`, offset from the live "now" by a number of months. */
function monthPrefix(offsetMonths = 0): string {
  const today = new Date()
  return formatYearMonth(
    new Date(today.getFullYear(), today.getMonth() + offsetMonths, 1),
  )
}

describe('createPlan', () => {
  it('creates a plan with defaults for nullable fields', async () => {
    const created = await createPlan({ date: '2026-03-01' } as never)
    expect(created.date).toBe('2026-03-01')
    expect(created.name).toBeNull()
    expect(created.notes).toBeNull()
    expect(created.isArchived).toBe(false)
  })

  it('honors provided fields', async () => {
    const created = await createPlan({
      date: '2026-04-01',
      name: 'April',
      notes: 'note',
      isArchived: true,
    })
    expect(created.name).toBe('April')
    expect(created.notes).toBe('note')
    expect(created.isArchived).toBe(true)
  })
})

describe('getPlanById', () => {
  it('returns the plan by id', async () => {
    await insertPlan('p-1', '2026-03-01', { name: 'March' })
    const plan = await getPlanById('p-1')
    expect(plan?.name).toBe('March')
  })

  it('returns undefined for unknown id', async () => {
    expect(await getPlanById('missing')).toBeUndefined()
  })
})

describe('getAllPlans', () => {
  it('returns active plans ordered by date desc', async () => {
    await insertPlan('a', '2026-01-01')
    await insertPlan('b', '2026-03-01')
    await insertPlan('c', '2026-02-01')
    const plans = await getAllPlans()
    expect(plans.map((p) => p.id)).toEqual(['b', 'c', 'a'])
  })

  it('excludes archived by default', async () => {
    await insertPlan('a', '2026-01-01', { isArchived: true })
    await insertPlan('b', '2026-02-01')
    const plans = await getAllPlans()
    expect(plans.map((p) => p.id)).toEqual(['b'])
  })

  it('includes archived when includeArchived=true', async () => {
    await insertPlan('a', '2026-01-01', { isArchived: true })
    await insertPlan('b', '2026-02-01')
    const plans = await getAllPlans(true)
    expect(plans.map((p) => p.id).sort()).toEqual(['a', 'b'])
  })

  it('filters by year', async () => {
    await insertPlan('a', '2025-12-01')
    await insertPlan('b', '2026-01-01')
    await insertPlan('c', '2026-06-01')
    const plans = await getAllPlans(false, 2026)
    expect(plans.map((p) => p.id).sort()).toEqual(['b', 'c'])
  })

  it('combines includeArchived and year', async () => {
    await insertPlan('a', '2026-01-01', { isArchived: true })
    await insertPlan('b', '2026-02-01')
    await insertPlan('c', '2025-12-01')
    const plans = await getAllPlans(true, 2026)
    expect(plans.map((p) => p.id).sort()).toEqual(['a', 'b'])
  })
})

describe('searchPlans', () => {
  beforeEach(async () => {
    await insertPlan('a', '2026-01-01', { name: 'January Plan' })
    await insertPlan('b', '2026-02-01', { name: 'February' })
    await insertPlan('c', '2026-03-01', { name: null })
  })

  it('matches by partial name (case-insensitive via LIKE)', async () => {
    const result = await searchPlans('Jan')
    expect(result.map((p) => p.id)).toEqual(['a'])
  })

  it('matches by partial date', async () => {
    const result = await searchPlans('2026-02')
    expect(result.map((p) => p.id)).toEqual(['b'])
  })

  it('returns empty when nothing matches', async () => {
    const result = await searchPlans('nonexistent')
    expect(result).toEqual([])
  })
})

describe('updatePlan', () => {
  it('updates only the provided fields', async () => {
    await insertPlan('a', '2026-01-01', { name: 'Old', notes: 'keep' })
    const updated = await updatePlan('a', { name: 'New' })
    expect(updated?.name).toBe('New')
    expect(updated?.notes).toBe('keep')
  })

  it('returns undefined for unknown id', async () => {
    const updated = await updatePlan('missing', { name: 'x' })
    expect(updated).toBeUndefined()
  })

  it('supports archiving', async () => {
    await insertPlan('a', '2026-01-01')
    const updated = await updatePlan('a', { isArchived: true })
    expect(updated?.isArchived).toBe(true)
  })
})

describe('deletePlan', () => {
  it('returns true and removes the plan when present', async () => {
    await insertPlan('a', '2026-01-01')
    const ok = await deletePlan('a')
    expect(ok).toBe(true)
    expect(await getPlanById('a')).toBeUndefined()
  })

  it('returns false for unknown id', async () => {
    expect(await deletePlan('missing')).toBe(false)
  })
})

describe('getAvailableYears', () => {
  it('returns distinct years sorted descending', async () => {
    await insertPlan('a', '2024-06-01')
    await insertPlan('b', '2026-01-01')
    await insertPlan('c', '2026-12-01')
    await insertPlan('d', '2025-04-01')
    const years = await getAvailableYears()
    expect(years).toEqual([2026, 2025, 2024])
  })

  it('skips entries with unparseable year prefix', async () => {
    await insertPlan('a', 'invalid-date')
    await insertPlan('b', '2026-01-01')
    const years = await getAvailableYears()
    expect(years).toEqual([2026])
  })

  it('returns empty when no plans exist', async () => {
    expect(await getAvailableYears()).toEqual([])
  })
})

describe('getCurrentMonthPlan', () => {
  it('finds an active plan whose date starts with the current YYYY-MM', async () => {
    await insertPlan('current', `${monthPrefix()}-15`)
    await insertPlan('other', '1999-01-01')
    const plan = await getCurrentMonthPlan()
    expect(plan?.id).toBe('current')
  })

  it('returns undefined when no plan exists for current month', async () => {
    await insertPlan('past', '1999-01-01')
    const plan = await getCurrentMonthPlan()
    expect(plan).toBeUndefined()
  })

  it('skips archived plans even if they match the current month', async () => {
    await insertPlan('archived', `${monthPrefix()}-15`, {
      isArchived: true,
    })
    expect(await getCurrentMonthPlan()).toBeUndefined()
  })
})

describe('getNextUpcomingPlan', () => {
  it('returns the nearest plan among multiple future-month plans', async () => {
    await insertPlan('later', `${monthPrefix(2)}-15`)
    await insertPlan('nearest', `${monthPrefix(1)}-01`)
    const plan = await getNextUpcomingPlan()
    expect(plan?.id).toBe('nearest')
  })

  it('excludes the current month, even a plan dated late in it', async () => {
    await insertPlan('current-late', `${monthPrefix()}-28`)
    expect(await getNextUpcomingPlan()).toBeUndefined()

    await insertPlan('future', `${monthPrefix(1)}-01`)
    const plan = await getNextUpcomingPlan()
    expect(plan?.id).toBe('future')
  })

  it('excludes past plans', async () => {
    await insertPlan('past', '1999-01-01')
    await insertPlan('future', `${monthPrefix(1)}-01`)
    const plan = await getNextUpcomingPlan()
    expect(plan?.id).toBe('future')
  })

  it('skips archived future plans', async () => {
    await insertPlan('archived-future', `${monthPrefix(1)}-15`, {
      isArchived: true,
    })
    expect(await getNextUpcomingPlan()).toBeUndefined()
  })

  it('returns undefined when no plans exist', async () => {
    expect(await getNextUpcomingPlan()).toBeUndefined()
  })
})

describe('getSidebarPlans', () => {
  it('returns current month + latest non-archived plan', async () => {
    await insertPlan('current', `${monthPrefix()}-01`)
    await insertPlan('future', '2099-12-01')
    await insertPlan('archived', '2099-12-15', { isArchived: true })
    const result = await getSidebarPlans()
    expect(result.currentMonth?.id).toBe('current')
    expect(result.latest?.id).toBe('future')
  })
})

describe('getActivePlan', () => {
  it('returns the current-month plan, not marked as upcoming', async () => {
    await insertPlan('current', `${monthPrefix()}-01`)
    const active = await getActivePlan()
    expect(active?.plan.id).toBe('current')
    expect(active?.isUpcoming).toBe(false)
  })

  it('falls back to the nearest upcoming plan, marked as upcoming', async () => {
    await insertPlan('future', `${monthPrefix(1)}-01`)
    const active = await getActivePlan()
    expect(active?.plan.id).toBe('future')
    expect(active?.isUpcoming).toBe(true)
  })

  it('returns undefined when no plan exists at all', async () => {
    expect(await getActivePlan()).toBeUndefined()
  })
})
