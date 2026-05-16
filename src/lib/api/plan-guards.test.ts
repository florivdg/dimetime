import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

const planSpy = mock<
  (
    id: string,
  ) => Promise<
    { id: string; date: string; isArchived: boolean } | null | undefined
  >
>(async () => null)

void mock.module('@/lib/plans', () => ({
  getPlanById: (id: string) => planSpy(id),
}))

const { requireUnarchivedPlan } = await import('./plan-guards')

beforeEach(() => {
  planSpy.mockReset()
})

afterEach(() => {
  planSpy.mockReset()
})

describe('requireUnarchivedPlan', () => {
  it('returns 404 when the plan is not found', async () => {
    planSpy.mockResolvedValueOnce(null)
    const result = await requireUnarchivedPlan('plan-1')
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(404)
    expect(await (result as Response).json()).toEqual({
      error: 'Plan nicht gefunden',
    })
  })

  it('returns 400 when the plan is archived', async () => {
    planSpy.mockResolvedValueOnce({
      id: 'plan-1',
      date: '2026-03-01',
      isArchived: true,
    })
    const result = await requireUnarchivedPlan('plan-1')
    expect((result as Response).status).toBe(400)
    expect(await (result as Response).json()).toEqual({
      error: 'Plan ist archiviert',
    })
  })

  it('returns the plan when it is unarchived', async () => {
    const plan = {
      id: 'plan-1',
      date: '2026-03-01',
      isArchived: false,
      name: null,
      notes: null,
      createdAt: new Date('2026-03-01'),
      updatedAt: new Date('2026-03-01'),
    }
    planSpy.mockResolvedValueOnce(plan)
    const result = await requireUnarchivedPlan('plan-1')
    expect(result).toEqual(plan)
  })

  it('honors custom not-found message', async () => {
    planSpy.mockResolvedValueOnce(null)
    const result = await requireUnarchivedPlan('plan-1', {
      notFound: 'Eigene Meldung',
    })
    expect(await (result as Response).json()).toEqual({
      error: 'Eigene Meldung',
    })
  })

  it('honors custom archived message and status', async () => {
    planSpy.mockResolvedValueOnce({
      id: 'plan-1',
      date: '2026-03-01',
      isArchived: true,
    })
    const result = await requireUnarchivedPlan('plan-1', {
      archived: 'Custom archived',
      archivedStatus: 403,
    })
    expect((result as Response).status).toBe(403)
    expect(await (result as Response).json()).toEqual({
      error: 'Custom archived',
    })
  })
})
