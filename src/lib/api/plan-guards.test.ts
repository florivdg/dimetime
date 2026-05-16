import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as plansSchema from '@/db/schema/plans'
import { createTestDb } from '@/lib/__fixtures__/test-db'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const { requireUnarchivedPlan } = await import('./plan-guards')

const now = new Date('2026-03-09T00:00:00.000Z')

async function seedPlan(id: string, isArchived = false) {
  await testDb.insert(plansSchema.plan).values({
    id,
    date: '2026-03-01',
    isArchived,
    createdAt: now,
    updatedAt: now,
  })
}

beforeEach(() => {
  harness.reset()
})

afterAll(() => {
  harness.close()
})

describe('requireUnarchivedPlan', () => {
  it('returns 404 when the plan is not found', async () => {
    const result = await requireUnarchivedPlan('missing')
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(404)
    expect(await (result as Response).json()).toEqual({
      error: 'Plan nicht gefunden',
    })
  })

  it('returns 400 when the plan is archived', async () => {
    await seedPlan('p-1', true)
    const result = await requireUnarchivedPlan('p-1')
    expect((result as Response).status).toBe(400)
    expect(await (result as Response).json()).toEqual({
      error: 'Plan ist archiviert',
    })
  })

  it('returns the plan when it is unarchived', async () => {
    await seedPlan('p-1', false)
    const result = await requireUnarchivedPlan('p-1')
    expect(result).not.toBeInstanceOf(Response)
    expect((result as { id: string }).id).toBe('p-1')
  })

  it('honors custom not-found message', async () => {
    const result = await requireUnarchivedPlan('missing', {
      notFound: 'Eigene Meldung',
    })
    expect(await (result as Response).json()).toEqual({
      error: 'Eigene Meldung',
    })
  })

  it('honors custom archived message and status', async () => {
    await seedPlan('p-1', true)
    const result = await requireUnarchivedPlan('p-1', {
      archived: 'Custom archived',
      archivedStatus: 403,
    })
    expect((result as Response).status).toBe(403)
    expect(await (result as Response).json()).toEqual({
      error: 'Custom archived',
    })
  })
})
