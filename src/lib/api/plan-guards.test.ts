import { describe, expect, it } from 'bun:test'
import { seedPlan as seedPlanRow } from '@/lib/__fixtures__/seeds'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'

const testDb = setupTestDb()

const { requireUnarchivedPlan } = await import('./plan-guards')

async function seedPlan(id: string, isArchived = false) {
  await seedPlanRow(testDb, { id, isArchived })
}

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
