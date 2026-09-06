import { beforeEach, describe, expect, it } from 'bun:test'
import { eq, getTableColumns } from 'drizzle-orm'
import { installmentPlan, plan, plannedTransaction } from '@/db/schema/plans'
import {
  seedCategory,
  seedInstallmentPlan,
  seedPlan,
  seedPlannedTransaction,
  seedUser,
  SEED_NOW,
} from '@/lib/__fixtures__/seeds'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'

const testDb = setupTestDb()

const {
  completeInstallmentPlan,
  createInstallmentPlan,
  deleteInstallmentPlan,
  findInstallmentPlan,
  getInstallmentOverview,
  loadInstallmentBadges,
  rateAmountAt,
  recordInstallmentSkip,
  syncInstallmentsIntoPlan,
  syncPlansForInstallment,
  updateInstallmentPlan,
} = await import('./installments')

const { createPlan, deletePlan } = await import('./plans')

const userId = 'u1'

/** Seed one plan per month, oldest month created first. */
async function seedMonthlyPlans(months: string[], isArchived = false) {
  for (const [index, month] of months.entries()) {
    await seedPlan(testDb, {
      id: `plan-${month}`,
      date: `${month}-01`,
      isArchived,
      createdAt: new Date(SEED_NOW.getTime() + index * 1000),
      updatedAt: SEED_NOW,
    })
  }
}

/** All rows linked to an installment, ordered by the month of their plan. */
async function linkedRows(installmentId: string) {
  const rows = await testDb
    .select({ ...getTableColumns(plannedTransaction), planDate: plan.date })
    .from(plannedTransaction)
    .leftJoin(plan, eq(plannedTransaction.planId, plan.id))
    .where(eq(plannedTransaction.installmentId, installmentId))
  return rows.sort((a, b) =>
    (a.planDate ?? a.dueDate).localeCompare(b.planDate ?? b.dueDate),
  )
}

async function linkedMonths(installmentId: string) {
  const rows = await linkedRows(installmentId)
  return rows.map((row) => (row.planDate ?? row.dueDate).substring(0, 7))
}

/** The installments of the overview snapshot, enriched with their counters. */
async function statsOf(today: string) {
  return (await getInstallmentOverview(today)).installments
}

beforeEach(async () => {
  await seedUser(testDb, { id: userId })
})

describe('installment stats', () => {
  it('computes the counters including the prepaid offset', async () => {
    await seedMonthlyPlans(['2026-01', '2026-02', '2026-03'])
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      amount: 5000,
      totalInstallments: 12,
      prepaidInstallments: 2,
      startMonth: '2026-01',
    })
    await seedPlannedTransaction(testDb, {
      id: 'r1',
      planId: 'plan-2026-01',
      installmentId: 'ip1',
      isDone: true,
      amount: 5000,
    })
    await seedPlannedTransaction(testDb, {
      id: 'r2',
      planId: 'plan-2026-02',
      installmentId: 'ip1',
      isDone: true,
      amount: 5000,
    })
    await seedPlannedTransaction(testDb, {
      id: 'r3',
      planId: 'plan-2026-03',
      installmentId: 'ip1',
      isDone: false,
      amount: 5000,
    })

    const [installment] = await statsOf('2026-03')
    expect(installment.paidCount).toBe(4)
    expect(installment.openLinkedCount).toBe(1)
    expect(installment.remainingCount).toBe(8)
    expect(installment.remainingSum).toBe(40000)
  })

  it('counts one checked row as one installment regardless of its amount', async () => {
    await seedMonthlyPlans(['2026-01'])
    await seedInstallmentPlan(testDb, { id: 'ip1', totalInstallments: 4 })
    await seedPlannedTransaction(testDb, {
      id: 'r1',
      planId: 'plan-2026-01',
      installmentId: 'ip1',
      isDone: true,
      amount: 123,
    })

    const [installment] = await statsOf('2026-03')
    expect(installment.paidCount).toBe(1)
    expect(installment.remainingCount).toBe(3)
  })

  it('enriches with category name and color', async () => {
    await seedCategory(testDb, { id: 'c1', name: 'Technik', color: '#fff' })
    await seedInstallmentPlan(testDb, { id: 'ip1', categoryId: 'c1' })

    const [installment] = await statsOf('2026-03')
    expect(installment.categoryName).toBe('Technik')
    expect(installment.categoryColor).toBe('#fff')
  })
})

describe('findInstallmentPlan', () => {
  it('returns the stored row', async () => {
    await seedInstallmentPlan(testDb, { id: 'ip1', totalInstallments: 6 })
    const installment = await findInstallmentPlan('ip1')
    expect(installment?.totalInstallments).toBe(6)
  })

  it('returns undefined for an unknown id', async () => {
    expect(await findInstallmentPlan('missing')).toBeUndefined()
  })
})

describe('createInstallmentPlan', () => {
  it('persists the input and fills the eligible plans', async () => {
    await seedMonthlyPlans(['2026-03', '2026-04'])
    const created = await createInstallmentPlan(
      {
        name: 'Sofa',
        amount: 7500,
        totalInstallments: 5,
        startMonth: '2026-03',
        dayOfMonth: 15,
        note: 'Möbelhaus',
      },
      userId,
    )

    expect(created.name).toBe('Sofa')
    expect(created.prepaidInstallments).toBe(0)
    expect(created.completedAt).toBeNull()

    const rows = await linkedRows(created.id)
    expect(rows).toHaveLength(2)
    expect(rows[0].dueDate).toBe('2026-03-15')
    expect(rows[0].type).toBe('expense')
    expect(rows[0].amount).toBe(7500)
    expect(rows[0].isBudget).toBe(false)
    expect(rows[0].isDone).toBe(false)
    expect(rows[0].userId).toBe(userId)
    expect(rows[1].dueDate).toBe('2026-04-15')
  })

  it('clamps the day of month to the last day of the month', async () => {
    await seedMonthlyPlans(['2026-02'])
    const created = await createInstallmentPlan(
      {
        name: 'Rate',
        amount: 1000,
        totalInstallments: 2,
        startMonth: '2026-02',
        dayOfMonth: 31,
      },
      userId,
    )

    const rows = await linkedRows(created.id)
    expect(rows[0].dueDate).toBe('2026-02-28')
  })
})

describe('syncInstallmentsIntoPlan (via createPlan)', () => {
  it('pulls every eligible installment into a freshly created plan', async () => {
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      name: 'Laptop',
      amount: 4000,
      totalInstallments: 10,
      startMonth: '2026-01',
    })
    await seedInstallmentPlan(testDb, {
      id: 'ip2',
      name: 'Später',
      startMonth: '2026-09',
    })

    const created = await createPlan({ date: '2026-05-01' } as never)

    expect(await linkedMonths('ip1')).toEqual(['2026-05'])
    expect(await linkedMonths('ip2')).toEqual([])

    const rows = await linkedRows('ip1')
    expect(rows[0].planId).toBe(created.id)
    expect(rows[0].name).toBe('Laptop')
    expect(rows[0].amount).toBe(4000)
  })

  it('is idempotent — a second sync inserts nothing', async () => {
    await seedInstallmentPlan(testDb, { id: 'ip1', startMonth: '2026-01' })
    const created = await createPlan({ date: '2026-05-01' } as never)

    expect(await syncInstallmentsIntoPlan(created.id)).toBe(0)
    expect(await linkedMonths('ip1')).toEqual(['2026-05'])
  })

  it('ignores completed installments', async () => {
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      startMonth: '2026-01',
      completedAt: SEED_NOW,
    })
    await createPlan({ date: '2026-05-01' } as never)
    expect(await linkedMonths('ip1')).toEqual([])
  })

  it('never touches archived plans', async () => {
    await seedInstallmentPlan(testDb, { id: 'ip1', startMonth: '2026-01' })
    await seedMonthlyPlans(['2026-05'], true)

    expect(await syncInstallmentsIntoPlan('plan-2026-05')).toBe(0)
    expect(await linkedMonths('ip1')).toEqual([])
  })

  it('only fills the oldest plan of a month', async () => {
    await seedInstallmentPlan(testDb, { id: 'ip1', startMonth: '2026-01' })
    await seedMonthlyPlans(['2026-05'])

    // The seeded plan is older than the one created now
    const second = await createPlan({ date: '2026-05-20' } as never)

    expect(await syncInstallmentsIntoPlan(second.id)).toBe(0)
    expect(await syncInstallmentsIntoPlan('plan-2026-05')).toBe(1)

    const rows = await linkedRows('ip1')
    expect(rows).toHaveLength(1)
    expect(rows[0].planId).toBe('plan-2026-05')
  })

  it('returns 0 for an unknown plan', async () => {
    expect(await syncInstallmentsIntoPlan('missing')).toBe(0)
  })
})

describe('syncPlansForInstallment', () => {
  it('retro-fills existing plans chronologically within the budget', async () => {
    await seedMonthlyPlans(['2026-01', '2026-02', '2026-03', '2026-04'])
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      totalInstallments: 3,
      prepaidInstallments: 1,
      startMonth: '2026-01',
    })

    expect(await syncPlansForInstallment('ip1')).toBe(2)
    expect(await linkedMonths('ip1')).toEqual(['2026-01', '2026-02'])
  })

  it('starts at the start month and never fills earlier plans', async () => {
    await seedMonthlyPlans(['2026-01', '2026-02', '2026-03'])
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      totalInstallments: 5,
      startMonth: '2026-02',
    })

    await syncPlansForInstallment('ip1')
    expect(await linkedMonths('ip1')).toEqual(['2026-02', '2026-03'])
  })

  it('respects existing rows when calculating the budget', async () => {
    await seedMonthlyPlans(['2026-01', '2026-02', '2026-03'])
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      totalInstallments: 2,
      startMonth: '2026-01',
    })
    await seedPlannedTransaction(testDb, {
      id: 'r1',
      planId: 'plan-2026-01',
      installmentId: 'ip1',
      isDone: true,
    })

    expect(await syncPlansForInstallment('ip1')).toBe(1)
    expect(await linkedMonths('ip1')).toEqual(['2026-01', '2026-02'])
  })

  it('skips archived plans and months without a plan', async () => {
    await seedMonthlyPlans(['2026-01', '2026-03'])
    await seedMonthlyPlans(['2026-02'], true)
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      totalInstallments: 4,
      startMonth: '2026-01',
    })

    await syncPlansForInstallment('ip1')
    expect(await linkedMonths('ip1')).toEqual(['2026-01', '2026-03'])
  })

  it('does not re-insert into a tombstoned month', async () => {
    await seedMonthlyPlans(['2026-01', '2026-02', '2026-03'])
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      totalInstallments: 2,
      startMonth: '2026-01',
    })
    await recordInstallmentSkip('ip1', '2026-02')

    await syncPlansForInstallment('ip1')
    expect(await linkedMonths('ip1')).toEqual(['2026-01', '2026-03'])
  })

  it('returns 0 for an unknown installment', async () => {
    expect(await syncPlansForInstallment('missing')).toBe(0)
  })

  it('does not fill plans for a completed installment', async () => {
    await seedMonthlyPlans(['2026-01'])
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      startMonth: '2026-01',
      completedAt: SEED_NOW,
    })

    expect(await syncPlansForInstallment('ip1')).toBe(0)
    expect(await linkedMonths('ip1')).toEqual([])
  })
})

describe('updateInstallmentPlan', () => {
  beforeEach(async () => {
    await seedMonthlyPlans(['2026-01', '2026-02', '2026-03'])
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      amount: 5000,
      totalInstallments: 6,
      startMonth: '2026-01',
    })
    await seedPlannedTransaction(testDb, {
      id: 'done-old-rate',
      planId: 'plan-2026-01',
      installmentId: 'ip1',
      isDone: true,
      amount: 5000,
    })
    await seedPlannedTransaction(testDb, {
      id: 'open-old-rate',
      planId: 'plan-2026-02',
      installmentId: 'ip1',
      isDone: false,
      amount: 5000,
    })
    await seedPlannedTransaction(testDb, {
      id: 'open-edited',
      planId: 'plan-2026-03',
      installmentId: 'ip1',
      isDone: false,
      amount: 4200,
    })
  })

  it('reprices only open rows that still carry the previous rate', async () => {
    await updateInstallmentPlan('ip1', { amount: 6000 })

    const rows = Object.fromEntries(
      (await linkedRows('ip1')).map((row) => [row.id, row.amount]),
    )
    expect(rows['done-old-rate']).toBe(5000)
    expect(rows['open-old-rate']).toBe(6000)
    expect(rows['open-edited']).toBe(4200)
  })

  it('reprices every untouched row of the same batch at once', async () => {
    // Both open rows now mirror the installment → identical patch, one UPDATE
    await testDb
      .update(plannedTransaction)
      .set({ amount: 5000, name: 'Rate' })
      .where(eq(plannedTransaction.id, 'open-edited'))
    await testDb
      .update(plannedTransaction)
      .set({ name: 'Rate' })
      .where(eq(plannedTransaction.id, 'open-old-rate'))

    await updateInstallmentPlan('ip1', { amount: 6000, name: 'Neuer Name' })

    const rows = Object.fromEntries(
      (await linkedRows('ip1')).map((row) => [row.id, row]),
    )
    expect(rows['open-old-rate'].amount).toBe(6000)
    expect(rows['open-edited'].amount).toBe(6000)
    expect(rows['open-old-rate'].name).toBe('Neuer Name')
    expect(rows['open-edited'].name).toBe('Neuer Name')
    expect(rows['done-old-rate'].amount).toBe(5000)
  })

  it('recomputes a distinct due date per plan month', async () => {
    await testDb
      .update(installmentPlan)
      .set({ dayOfMonth: 5 })
      .where(eq(installmentPlan.id, 'ip1'))
    for (const [id, dueDate] of [
      ['open-old-rate', '2026-02-05'],
      ['open-edited', '2026-03-05'],
    ]) {
      await testDb
        .update(plannedTransaction)
        .set({ dueDate })
        .where(eq(plannedTransaction.id, id))
    }

    await updateInstallmentPlan('ip1', { dayOfMonth: 20 })

    const dueDates = Object.fromEntries(
      (await linkedRows('ip1')).map((row) => [row.id, row.dueDate]),
    )
    expect(dueDates['open-old-rate']).toBe('2026-02-20')
    expect(dueDates['open-edited']).toBe('2026-03-20')
  })

  it('updates only the provided fields', async () => {
    const updated = await updateInstallmentPlan('ip1', { name: 'Neu' })
    expect(updated?.name).toBe('Neu')
    expect(updated?.amount).toBe(5000)
  })

  it('re-syncs after raising the total number of installments', async () => {
    // 6 total, 3 materialized → the plans of 2026-01..03 are all taken
    expect(await linkedMonths('ip1')).toEqual(['2026-01', '2026-02', '2026-03'])
    await seedMonthlyPlans(['2026-04'])
    await updateInstallmentPlan('ip1', { totalInstallments: 8 })

    expect(await linkedMonths('ip1')).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
    ])
  })

  it('returns undefined for an unknown id', async () => {
    expect(
      await updateInstallmentPlan('missing', { name: 'x' }),
    ).toBeUndefined()
  })

  it('prunes surplus open rows newest month first when the total is lowered', async () => {
    // 1 checked + 2 open rows; lowering the total to 2 leaves room for one open row
    await updateInstallmentPlan('ip1', { totalInstallments: 2 })

    expect((await linkedRows('ip1')).map((row) => row.id)).toEqual([
      'done-old-rate',
      'open-old-rate',
    ])
  })

  it('prunes surplus open rows when the prepaid count is raised', async () => {
    await updateInstallmentPlan('ip1', { prepaidInstallments: 4 })

    // 4 prepaid + 1 checked leaves budget for exactly one open row
    expect((await linkedRows('ip1')).map((row) => row.id)).toEqual([
      'done-old-rate',
      'open-old-rate',
    ])
  })

  it('keeps the invariant violated instead of pruning archived plans', async () => {
    await testDb
      .update(plan)
      .set({ isArchived: true })
      .where(eq(plan.id, 'plan-2026-03'))

    await updateInstallmentPlan('ip1', { totalInstallments: 1 })

    // Only the open row in the non-archived plan may go
    expect((await linkedRows('ip1')).map((row) => row.id)).toEqual([
      'done-old-rate',
      'open-edited',
    ])
  })

  it('deletes open rows before a start month that moved into the future', async () => {
    await updateInstallmentPlan('ip1', { startMonth: '2026-03' })

    const rows = await linkedRows('ip1')
    // The checked row of 2026-01 stays as history, the open 2026-02 row goes
    expect(rows.map((row) => row.id)).toEqual(['done-old-rate', 'open-edited'])
  })

  it('re-fills later months after the start month moved', async () => {
    await seedMonthlyPlans(['2026-04', '2026-05'])
    await updateInstallmentPlan('ip1', { startMonth: '2026-03' })

    expect(await linkedMonths('ip1')).toEqual([
      '2026-01',
      '2026-03',
      '2026-04',
      '2026-05',
    ])
  })

  it('propagates the name to untouched open rows only', async () => {
    // 'Rate' is the installment name every untouched row mirrors
    await testDb
      .update(plannedTransaction)
      .set({ name: 'Rate' })
      .where(eq(plannedTransaction.id, 'open-old-rate'))
    await testDb
      .update(plannedTransaction)
      .set({ name: 'Handgeschrieben' })
      .where(eq(plannedTransaction.id, 'open-edited'))

    await updateInstallmentPlan('ip1', { name: 'Neuer Name' })

    const names = Object.fromEntries(
      (await linkedRows('ip1')).map((row) => [row.id, row.name]),
    )
    expect(names['open-old-rate']).toBe('Neuer Name')
    expect(names['open-edited']).toBe('Handgeschrieben')
  })

  it('propagates the category to untouched open rows only', async () => {
    await seedCategory(testDb, { id: 'c-old', name: 'Alt' })
    await seedCategory(testDb, { id: 'c-new', name: 'Neu' })
    await seedCategory(testDb, { id: 'c-manual', name: 'Manuell' })
    await testDb
      .update(installmentPlan)
      .set({ categoryId: 'c-old' })
      .where(eq(installmentPlan.id, 'ip1'))
    await testDb
      .update(plannedTransaction)
      .set({ categoryId: 'c-old' })
      .where(eq(plannedTransaction.id, 'open-old-rate'))
    await testDb
      .update(plannedTransaction)
      .set({ categoryId: 'c-manual' })
      .where(eq(plannedTransaction.id, 'open-edited'))

    await updateInstallmentPlan('ip1', { categoryId: 'c-new' })

    const categories = Object.fromEntries(
      (await linkedRows('ip1')).map((row) => [row.id, row.categoryId]),
    )
    expect(categories['done-old-rate']).toBeNull()
    expect(categories['open-old-rate']).toBe('c-new')
    expect(categories['open-edited']).toBe('c-manual')
  })

  it('recomputes the due date of untouched open rows when the day of month changes', async () => {
    await testDb
      .update(installmentPlan)
      .set({ dayOfMonth: 5 })
      .where(eq(installmentPlan.id, 'ip1'))
    await testDb
      .update(plannedTransaction)
      .set({ dueDate: '2026-02-05' })
      .where(eq(plannedTransaction.id, 'open-old-rate'))
    await testDb
      .update(plannedTransaction)
      .set({ dueDate: '2026-03-22' })
      .where(eq(plannedTransaction.id, 'open-edited'))

    await updateInstallmentPlan('ip1', { dayOfMonth: 20 })

    const dueDates = Object.fromEntries(
      (await linkedRows('ip1')).map((row) => [row.id, row.dueDate]),
    )
    expect(dueDates['open-old-rate']).toBe('2026-02-20')
    expect(dueDates['open-edited']).toBe('2026-03-22')
  })

  it('never reprices rows inside archived plans', async () => {
    await testDb
      .update(plannedTransaction)
      .set({ name: 'Rate' })
      .where(eq(plannedTransaction.id, 'open-old-rate'))
    await testDb
      .update(plan)
      .set({ isArchived: true })
      .where(eq(plan.id, 'plan-2026-02'))

    await updateInstallmentPlan('ip1', { amount: 6000, name: 'Neuer Name' })

    const rows = Object.fromEntries(
      (await linkedRows('ip1')).map((row) => [row.id, row]),
    )
    expect(rows['open-old-rate'].amount).toBe(5000)
    expect(rows['open-old-rate'].name).toBe('Rate')
  })
})

describe('completeInstallmentPlan', () => {
  it('removes open rows, keeps checked ones and stops the sync', async () => {
    await seedMonthlyPlans(['2026-01', '2026-02', '2026-03'])
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      totalInstallments: 6,
      startMonth: '2026-01',
    })
    await seedPlannedTransaction(testDb, {
      id: 'done',
      planId: 'plan-2026-01',
      installmentId: 'ip1',
      isDone: true,
    })
    await seedPlannedTransaction(testDb, {
      id: 'open',
      planId: 'plan-2026-02',
      installmentId: 'ip1',
      isDone: false,
    })

    const completed = await completeInstallmentPlan('ip1')
    expect(completed?.completedAt).toBeInstanceOf(Date)

    const rows = await linkedRows('ip1')
    expect(rows.map((row) => row.id)).toEqual(['done'])

    expect(await syncPlansForInstallment('ip1')).toBe(0)
  })

  it('keeps open rows inside archived plans as history', async () => {
    await seedMonthlyPlans(['2026-01', '2026-02'])
    await seedMonthlyPlans(['2026-03'], true)
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      totalInstallments: 6,
      startMonth: '2026-01',
    })
    await seedPlannedTransaction(testDb, {
      id: 'open-active',
      planId: 'plan-2026-02',
      installmentId: 'ip1',
    })
    await seedPlannedTransaction(testDb, {
      id: 'open-archived',
      planId: 'plan-2026-03',
      installmentId: 'ip1',
    })

    await completeInstallmentPlan('ip1')

    expect((await linkedRows('ip1')).map((row) => row.id)).toEqual([
      'open-archived',
    ])
  })

  it('returns undefined for an unknown id', async () => {
    expect(await completeInstallmentPlan('missing')).toBeUndefined()
  })
})

describe('deleteInstallmentPlan', () => {
  it('deletes open rows and keeps checked rows as history', async () => {
    await seedMonthlyPlans(['2026-01', '2026-02'])
    await seedInstallmentPlan(testDb, { id: 'ip1', startMonth: '2026-01' })
    await seedPlannedTransaction(testDb, {
      id: 'done',
      planId: 'plan-2026-01',
      installmentId: 'ip1',
      isDone: true,
    })
    await seedPlannedTransaction(testDb, {
      id: 'open',
      planId: 'plan-2026-02',
      installmentId: 'ip1',
      isDone: false,
    })

    expect(await deleteInstallmentPlan('ip1')).toBe(true)
    expect(await findInstallmentPlan('ip1')).toBeUndefined()

    const rows = await testDb.select().from(plannedTransaction)
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('done')
    expect(rows[0].installmentId).toBeNull()
    expect(rows[0].planId).toBe('plan-2026-01')
  })

  it('keeps open rows inside archived plans as history', async () => {
    await seedMonthlyPlans(['2026-01'])
    await seedMonthlyPlans(['2026-02'], true)
    await seedInstallmentPlan(testDb, { id: 'ip1', startMonth: '2026-01' })
    await seedPlannedTransaction(testDb, {
      id: 'open-active',
      planId: 'plan-2026-01',
      installmentId: 'ip1',
    })
    await seedPlannedTransaction(testDb, {
      id: 'open-archived',
      planId: 'plan-2026-02',
      installmentId: 'ip1',
    })

    expect(await deleteInstallmentPlan('ip1')).toBe(true)

    const rows = await testDb.select().from(plannedTransaction)
    expect(rows.map((row) => row.id)).toEqual(['open-archived'])
    expect(rows[0].installmentId).toBeNull()
  })

  it('returns false for an unknown id', async () => {
    expect(await deleteInstallmentPlan('missing')).toBe(false)
  })
})

describe('recordInstallmentSkip', () => {
  beforeEach(async () => {
    await seedInstallmentPlan(testDb, { id: 'ip1', startMonth: '2026-01' })
  })

  it('is idempotent', async () => {
    expect(await recordInstallmentSkip('ip1', '2026-02')).toBe(true)
    expect(await recordInstallmentSkip('ip1', '2026-02')).toBe(false)
  })
})

describe('projection', () => {
  it('projects the end month from today, honoring tombstones', async () => {
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      totalInstallments: 6,
      startMonth: '2026-01',
    })

    const [before] = await statsOf('2026-03')
    expect(before.projectedEndMonth).toBe('2026-08')

    await recordInstallmentSkip('ip1', '2026-05')
    const [after] = await statsOf('2026-03')
    expect(after.projectedEndMonth).toBe('2026-09')
  })

  it('starts at the start month when it lies in the future', async () => {
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      totalInstallments: 3,
      startMonth: '2026-06',
    })

    const [installment] = await statsOf('2026-03')
    expect(installment.projectedEndMonth).toBe('2026-08')
  })

  it('crosses the year boundary', async () => {
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      totalInstallments: 4,
      startMonth: '2026-11',
    })

    const [installment] = await statsOf('2026-11')
    expect(installment.projectedEndMonth).toBe('2027-02')
  })

  it('shifts the end month when a checked installment is unchecked again', async () => {
    await seedMonthlyPlans(['2026-01', '2026-02', '2026-03'])
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      totalInstallments: 6,
      startMonth: '2026-01',
    })
    await seedPlannedTransaction(testDb, {
      id: 'r1',
      planId: 'plan-2026-01',
      installmentId: 'ip1',
      isDone: true,
    })
    await seedPlannedTransaction(testDb, {
      id: 'r2',
      planId: 'plan-2026-02',
      installmentId: 'ip1',
      isDone: true,
    })

    const [checked] = await statsOf('2026-03')
    expect(checked.remainingCount).toBe(4)
    expect(checked.projectedEndMonth).toBe('2026-06')

    await testDb
      .update(plannedTransaction)
      .set({ isDone: false })
      .where(eq(plannedTransaction.id, 'r2'))

    const [unchecked] = await statsOf('2026-03')
    expect(unchecked.remainingCount).toBe(5)
    expect(unchecked.projectedEndMonth).toBe('2026-07')
  })

  it('does not re-book a current month that is already checked off', async () => {
    await seedMonthlyPlans(['2026-01', '2026-02', '2026-03'])
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      amount: 5000,
      totalInstallments: 6,
      startMonth: '2026-01',
    })
    for (const month of ['2026-01', '2026-02', '2026-03']) {
      await seedPlannedTransaction(testDb, {
        id: `r-${month}`,
        planId: `plan-${month}`,
        installmentId: 'ip1',
        isDone: true,
      })
    }

    const [installment] = await statsOf('2026-03')
    expect(installment.remainingCount).toBe(3)
    expect(installment.projectedEndMonth).toBe('2026-06')

    const overview = await getInstallmentOverview('2026-03')
    expect(overview.timeline.map((month) => month.month)).toEqual([
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
    ])
    expect(overview.timeline.map((month) => month.total)).toEqual([
      0, 5000, 5000, 5000,
    ])
    // The rate of the current month was already paid, its burden still counts
    expect(overview.aggregates.currentMonthlyLoad).toBe(5000)
  })

  it('skips a month that was paid ahead', async () => {
    await seedMonthlyPlans(['2026-03', '2026-04', '2026-05'])
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      totalInstallments: 4,
      startMonth: '2026-03',
    })
    await seedPlannedTransaction(testDb, {
      id: 'paid-ahead',
      planId: 'plan-2026-05',
      installmentId: 'ip1',
      isDone: true,
    })

    const [installment] = await statsOf('2026-03')
    expect(installment.remainingCount).toBe(3)
    expect(installment.projectedEndMonth).toBe('2026-06')

    const overview = await getInstallmentOverview('2026-03')
    expect(
      overview.timeline
        .filter((month) => month.entries.length > 0)
        .map((month) => month.month),
    ).toEqual(['2026-03', '2026-04', '2026-06'])
  })

  it('has no projected end month once nothing is left', async () => {
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      totalInstallments: 2,
      prepaidInstallments: 2,
      startMonth: '2026-01',
    })

    const [installment] = await statsOf('2026-03')
    expect(installment.remainingCount).toBe(0)
    expect(installment.projectedEndMonth).toBeNull()
  })
})

describe('getInstallmentOverview', () => {
  beforeEach(async () => {
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      name: 'Laptop',
      amount: 5000,
      totalInstallments: 3,
      startMonth: '2026-01',
    })
    await seedInstallmentPlan(testDb, {
      id: 'ip2',
      name: 'Sofa',
      amount: 2000,
      totalInstallments: 2,
      startMonth: '2026-04',
    })
  })

  it('aggregates the current load and the remaining sum', async () => {
    const overview = await getInstallmentOverview('2026-03')
    expect(overview.installments).toHaveLength(2)
    // Only ip1 is due in 2026-03, ip2 starts later
    expect(overview.aggregates.currentMonthlyLoad).toBe(5000)
    expect(overview.aggregates.totalRemainingSum).toBe(3 * 5000 + 2 * 2000)
  })

  it('excludes tombstoned months from the current load', async () => {
    await recordInstallmentSkip('ip1', '2026-03')
    const overview = await getInstallmentOverview('2026-03')
    expect(overview.aggregates.currentMonthlyLoad).toBe(0)
  })

  it('builds a contiguous timeline until the last installment ends', async () => {
    const overview = await getInstallmentOverview('2026-03')
    expect(overview.timeline.map((month) => month.month)).toEqual([
      '2026-03',
      '2026-04',
      '2026-05',
    ])
    expect(overview.timeline.map((month) => month.total)).toEqual([
      5000, 7000, 7000,
    ])
    expect(overview.timeline[1].entries).toEqual([
      { installmentId: 'ip1', name: 'Laptop', amount: 5000 },
      { installmentId: 'ip2', name: 'Sofa', amount: 2000 },
    ])
  })

  it('ignores completed installments in the aggregates and the timeline', async () => {
    await completeInstallmentPlan('ip1')
    const overview = await getInstallmentOverview('2026-03')
    expect(overview.installments).toHaveLength(2)
    expect(overview.aggregates.currentMonthlyLoad).toBe(0)
    expect(overview.aggregates.totalRemainingSum).toBe(4000)
    expect(overview.timeline.map((month) => month.month)).toEqual([
      '2026-03',
      '2026-04',
      '2026-05',
    ])
    expect(overview.timeline[0].total).toBe(0)
  })

  it('returns an empty timeline without running installments', async () => {
    await completeInstallmentPlan('ip1')
    await completeInstallmentPlan('ip2')
    const overview = await getInstallmentOverview('2026-03')
    expect(overview.timeline).toEqual([])
    expect(overview.aggregates.totalRemainingSum).toBe(0)
  })
})

describe('abweichende Schlussrate', () => {
  /** Rate amounts of the linked rows, ordered by their plan month. */
  async function linkedAmounts(installmentId: string) {
    return (await linkedRows(installmentId)).map((row) => row.amount)
  }

  describe('rateAmountAt', () => {
    const rates = { amount: 5000, finalAmount: 4735, totalInstallments: 3 }

    it('charges the final rate for the last installment only', () => {
      expect(rateAmountAt(rates, 1)).toBe(5000)
      expect(rateAmountAt(rates, 2)).toBe(5000)
      expect(rateAmountAt(rates, 3)).toBe(4735)
    })

    it('falls back to the regular rate without a final one', () => {
      expect(rateAmountAt({ ...rates, finalAmount: null }, 3)).toBe(5000)
    })
  })

  describe('materialization', () => {
    it('gives the last row the final rate', async () => {
      await seedMonthlyPlans(['2026-01', '2026-02', '2026-03'])
      await createInstallmentPlan(
        {
          name: 'Waschmaschine',
          amount: 5000,
          finalAmount: 4735,
          totalInstallments: 3,
          startMonth: '2026-01',
        },
        userId,
      )
      const [created] = await testDb.select().from(installmentPlan)

      expect(created.finalAmount).toBe(4735)
      expect(await linkedAmounts(created.id)).toEqual([5000, 5000, 4735])
    })

    it('counts the prepaid installments towards the position', async () => {
      await seedMonthlyPlans(['2026-01', '2026-02'])
      await seedInstallmentPlan(testDb, {
        id: 'ip1',
        amount: 5000,
        finalAmount: 4735,
        totalInstallments: 3,
        prepaidInstallments: 1,
        startMonth: '2026-01',
      })
      await syncPlansForInstallment('ip1')

      expect(await linkedAmounts('ip1')).toEqual([5000, 4735])
    })

    it('keeps the final rate last when a month is tombstoned', async () => {
      await seedMonthlyPlans(['2026-01', '2026-02', '2026-03'])
      await seedInstallmentPlan(testDb, {
        id: 'ip1',
        amount: 5000,
        finalAmount: 4735,
        totalInstallments: 2,
        startMonth: '2026-01',
      })
      await recordInstallmentSkip('ip1', '2026-02')
      await syncPlansForInstallment('ip1')

      expect(await linkedMonths('ip1')).toEqual(['2026-01', '2026-03'])
      expect(await linkedAmounts('ip1')).toEqual([5000, 4735])
    })

    it('continues the positions when a later plan is added', async () => {
      await seedMonthlyPlans(['2026-01'])
      await seedInstallmentPlan(testDb, {
        id: 'ip1',
        amount: 5000,
        finalAmount: 4735,
        totalInstallments: 2,
        startMonth: '2026-01',
      })
      await syncPlansForInstallment('ip1')
      expect(await linkedAmounts('ip1')).toEqual([5000])

      await createPlan({ date: '2026-02-01' } as never)
      expect(await linkedAmounts('ip1')).toEqual([5000, 4735])
    })
  })

  describe('repricing on update', () => {
    beforeEach(async () => {
      await seedMonthlyPlans(['2026-01', '2026-02', '2026-03'])
      await seedInstallmentPlan(testDb, {
        id: 'ip1',
        amount: 5000,
        finalAmount: 4735,
        totalInstallments: 3,
        startMonth: '2026-01',
      })
      await syncPlansForInstallment('ip1')
    })

    it('leaves the final rate alone when the regular rate changes', async () => {
      await updateInstallmentPlan('ip1', { amount: 6000 })
      expect(await linkedAmounts('ip1')).toEqual([6000, 6000, 4735])
    })

    it('reprices only the last row when the final rate changes', async () => {
      await updateInstallmentPlan('ip1', { finalAmount: 4200 })
      expect(await linkedAmounts('ip1')).toEqual([5000, 5000, 4200])
    })

    it('flattens the rates again when the final rate is cleared', async () => {
      await updateInstallmentPlan('ip1', { finalAmount: null })
      expect(await linkedAmounts('ip1')).toEqual([5000, 5000, 5000])
    })

    it('moves the final rate along when the prepaid count is raised', async () => {
      // One prepaid rate shifts every position up, so the surplus row is
      // pruned and the new last row carries the final rate
      await updateInstallmentPlan('ip1', { prepaidInstallments: 1 })
      expect(await linkedMonths('ip1')).toEqual(['2026-01', '2026-02'])
      expect(await linkedAmounts('ip1')).toEqual([5000, 4735])
    })

    it('moves the final rate along when the total is raised', async () => {
      await updateInstallmentPlan('ip1', { totalInstallments: 4 })
      expect(await linkedAmounts('ip1')).toEqual([5000, 5000, 5000])

      await createPlan({ date: '2026-04-01' } as never)
      expect(await linkedAmounts('ip1')).toEqual([5000, 5000, 5000, 4735])
    })

    it('never touches a manually edited row', async () => {
      await testDb
        .update(plannedTransaction)
        .set({ amount: 9900 })
        .where(eq(plannedTransaction.planId, 'plan-2026-03'))

      await updateInstallmentPlan('ip1', { amount: 6000, finalAmount: 4200 })
      expect(await linkedAmounts('ip1')).toEqual([6000, 6000, 9900])
    })
  })

  describe('rank-based repricing', () => {
    /** Three rates of 5000 with a differing final one of 4735. */
    async function seedFinalRatePlan(startMonth = '2026-01') {
      await seedInstallmentPlan(testDb, {
        id: 'ip1',
        amount: 5000,
        finalAmount: 4735,
        totalInstallments: 3,
        startMonth,
      })
    }

    it('moves the final rate on when a month is deleted and skipped', async () => {
      await seedMonthlyPlans(['2026-01', '2026-02', '2026-03', '2026-04'])
      await seedFinalRatePlan()
      await syncPlansForInstallment('ip1')

      await testDb
        .delete(plannedTransaction)
        .where(eq(plannedTransaction.planId, 'plan-2026-02'))
      await recordInstallmentSkip('ip1', '2026-02')
      await syncPlansForInstallment('ip1')

      expect(await linkedMonths('ip1')).toEqual([
        '2026-01',
        '2026-03',
        '2026-04',
      ])
      expect(await linkedAmounts('ip1')).toEqual([5000, 5000, 4735])
    })

    it('keeps a manual edit while the rates around it move on', async () => {
      await seedMonthlyPlans(['2026-01', '2026-02', '2026-03', '2026-04'])
      await seedFinalRatePlan()
      await syncPlansForInstallment('ip1')

      await testDb
        .update(plannedTransaction)
        .set({ amount: 9900 })
        .where(eq(plannedTransaction.planId, 'plan-2026-03'))
      await testDb
        .delete(plannedTransaction)
        .where(eq(plannedTransaction.planId, 'plan-2026-02'))
      await recordInstallmentSkip('ip1', '2026-02')
      await syncPlansForInstallment('ip1')

      expect(await linkedAmounts('ip1')).toEqual([5000, 9900, 4735])
    })

    it('renumbers the rates when an earlier plan is created', async () => {
      await seedMonthlyPlans(['2026-03', '2026-04'])
      await seedFinalRatePlan()
      await syncPlansForInstallment('ip1')
      expect(await linkedAmounts('ip1')).toEqual([5000, 5000])

      await createPlan({ date: '2026-02-01' } as never)

      expect(await linkedMonths('ip1')).toEqual([
        '2026-02',
        '2026-03',
        '2026-04',
      ])
      expect(await linkedAmounts('ip1')).toEqual([5000, 5000, 4735])
    })

    it('renumbers the rates after a plan in the middle was deleted', async () => {
      await seedMonthlyPlans(['2026-01', '2026-02', '2026-03'])
      await seedFinalRatePlan()
      await syncPlansForInstallment('ip1')

      await deletePlan('plan-2026-02')
      await createPlan({ date: '2026-04-01' } as never)

      expect(await linkedMonths('ip1')).toEqual([
        '2026-01',
        '2026-03',
        '2026-04',
      ])
      expect(await linkedAmounts('ip1')).toEqual([5000, 5000, 4735])
    })

    it('moves the final rate on when the start month moves forward', async () => {
      await seedMonthlyPlans(['2026-01', '2026-02', '2026-03', '2026-04'])
      await seedFinalRatePlan()
      await syncPlansForInstallment('ip1')

      await updateInstallmentPlan('ip1', { startMonth: '2026-02' })

      expect(await linkedMonths('ip1')).toEqual([
        '2026-02',
        '2026-03',
        '2026-04',
      ])
      expect(await linkedAmounts('ip1')).toEqual([5000, 5000, 4735])
    })

    it('reprices the rows backfilled by a start month moved back', async () => {
      await seedMonthlyPlans(['2026-01', '2026-02', '2026-03', '2026-04'])
      await seedFinalRatePlan('2026-03')
      await syncPlansForInstallment('ip1')
      expect(await linkedAmounts('ip1')).toEqual([5000, 5000])

      await updateInstallmentPlan('ip1', { startMonth: '2026-01' })

      expect(await linkedMonths('ip1')).toEqual([
        '2026-01',
        '2026-03',
        '2026-04',
      ])
      const amounts = await linkedAmounts('ip1')
      expect(amounts).toEqual([5000, 5000, 4735])
      // The materialized rows add up to exactly what is still owed
      const [stats] = await statsOf('2026-01')
      expect(stats.remainingSum).toBe(
        amounts.reduce((sum, amount) => sum + amount, 0),
      )
    })

    it('backfills and reprices in one update', async () => {
      await seedMonthlyPlans(['2026-01', '2026-02', '2026-03', '2026-04'])
      await seedFinalRatePlan('2026-03')
      await syncPlansForInstallment('ip1')

      await updateInstallmentPlan('ip1', {
        startMonth: '2026-01',
        amount: 6000,
      })

      expect(await linkedAmounts('ip1')).toEqual([6000, 6000, 4735])
    })
  })

  describe('stats and projection', () => {
    beforeEach(async () => {
      await seedInstallmentPlan(testDb, {
        id: 'ip1',
        name: 'Laptop',
        amount: 5000,
        finalAmount: 4735,
        totalInstallments: 3,
        startMonth: '2026-01',
      })
    })

    it('discounts the final rate in the remaining sum', async () => {
      const [stats] = await statsOf('2026-01')
      expect(stats.remainingCount).toBe(3)
      expect(stats.remainingSum).toBe(2 * 5000 + 4735)
    })

    it('shrinks the remaining sum down to the final rate alone', async () => {
      await updateInstallmentPlan('ip1', { prepaidInstallments: 2 })
      const [stats] = await statsOf('2026-01')
      expect(stats.remainingCount).toBe(1)
      expect(stats.remainingSum).toBe(4735)
    })

    it('charges the final rate in the last timeline month', async () => {
      const overview = await getInstallmentOverview('2026-01')
      expect(overview.timeline.map((month) => month.total)).toEqual([
        5000, 5000, 4735,
      ])
      expect(overview.timeline[2].entries).toEqual([
        { installmentId: 'ip1', name: 'Laptop', amount: 4735 },
      ])
    })

    it('charges the final rate in the current monthly load', async () => {
      await updateInstallmentPlan('ip1', { prepaidInstallments: 2 })
      const overview = await getInstallmentOverview('2026-01')
      expect(overview.aggregates.currentMonthlyLoad).toBe(4735)
      expect(overview.aggregates.totalRemainingSum).toBe(4735)
    })

    /** Check the row of one month off, as if it had been paid in advance. */
    async function checkOffMonth(month: string) {
      await seedMonthlyPlans(['2026-01', '2026-02', '2026-03'])
      await syncPlansForInstallment('ip1')
      await testDb
        .update(plannedTransaction)
        .set({ isDone: true })
        .where(eq(plannedTransaction.planId, `plan-${month}`))
    }

    it('stops charging the final rate once the last one is paid ahead', async () => {
      await checkOffMonth('2026-03')

      const overview = await getInstallmentOverview('2026-03')
      const [stats] = overview.installments
      expect(stats.remainingCount).toBe(2)
      // Two regular rates are left — the discounted one is already settled
      expect(stats.remainingSum).toBe(10000)
      expect(overview.aggregates.totalRemainingSum).toBe(10000)
      // The checked row of the current month is the final rate
      expect(overview.aggregates.currentMonthlyLoad).toBe(4735)
      expect(overview.timeline.map((month) => month.month)).toEqual([
        '2026-03',
        '2026-04',
        '2026-05',
      ])
      expect(overview.timeline.map((month) => month.total)).toEqual([
        0, 5000, 5000,
      ])
    })

    it('keeps the final rate ahead when an early month is paid', async () => {
      await checkOffMonth('2026-01')

      const overview = await getInstallmentOverview('2026-02')
      const [stats] = overview.installments
      expect(stats.remainingCount).toBe(2)
      expect(stats.remainingSum).toBe(5000 + 4735)
      expect(overview.timeline.map((month) => month.total)).toEqual([
        5000, 4735,
      ])
    })

    it('never shows the final rate in a projection cut off by the safety net', async () => {
      await updateInstallmentPlan('ip1', { totalInstallments: 1300 })

      const overview = await getInstallmentOverview('2026-01')
      // The projection stops after MAX_PROJECTION_MONTHS, well before the end
      expect(overview.timeline).toHaveLength(1200)
      expect(overview.timeline.every((month) => month.total === 5000)).toBe(
        true,
      )
      expect(overview.installments[0].projectedEndMonth).toBe('2125-12')
    })
  })
})

describe('loadInstallmentBadges', () => {
  beforeEach(async () => {
    await seedMonthlyPlans(['2026-03', '2026-04', '2026-05'])
    await seedInstallmentPlan(testDb, {
      id: 'ip1',
      name: 'Laptop',
      amount: 5000,
      totalInstallments: 12,
      prepaidInstallments: 3,
      startMonth: '2026-03',
    })
    await syncPlansForInstallment('ip1')
  })

  it('returns an empty map without linked rows', async () => {
    const badges = await loadInstallmentBadges([
      { id: 'x', installmentId: null },
    ])
    expect(badges.size).toBe(0)
  })

  it('numbers the rows chronologically including the prepaid offset', async () => {
    const rows = await linkedRows('ip1')
    const badges = await loadInstallmentBadges(rows)

    expect(rows.map((row) => badges.get(row.id)?.ratePosition)).toEqual([
      4, 5, 6,
    ])
    expect(badges.get(rows[0].id)).toEqual({
      installmentId: 'ip1',
      installmentName: 'Laptop',
      ratePosition: 4,
      rateTotal: 12,
    })
  })
})
