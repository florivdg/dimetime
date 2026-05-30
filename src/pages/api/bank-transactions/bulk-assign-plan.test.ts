import { beforeEach, describe, expect, it } from 'bun:test'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import { itRejectsInvalidJson } from '@/lib/__fixtures__/route-guards'
import { postExpectCount } from '@/lib/__fixtures__/bulk-route-assertions'
import {
  BULK_ASSIGN_IDS,
  seedPlan,
  seedSourceWithBankTransaction,
} from '@/lib/__fixtures__/seeds'

const testDb = setupTestDb()

const { POST } = await import('./bulk-assign-plan')

const planId = '11111111-1111-4111-8111-111111111111'
const archivedPlanId = '22222222-2222-4222-8222-222222222222'
const { btId } = BULK_ASSIGN_IDS

async function seed() {
  await seedPlan(testDb, { id: planId, date: '2026-03-01', isArchived: false })
  await seedPlan(testDb, {
    id: archivedPlanId,
    date: '2026-02-01',
    isArchived: true,
  })
  await seedSourceWithBankTransaction(testDb)
}

beforeEach(async () => {
  await seed()
})

describe('POST /api/bank-transactions/bulk-assign-plan', () => {
  itRejectsInvalidJson(POST)

  it('rejects empty ids/splitIds', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { planId, ids: [], splitIds: [] },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 404 when target plan missing', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: {
          planId: '99999999-9999-4999-8999-999999999999',
          ids: [btId],
        },
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('returns 400 when target plan archived', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { planId: archivedPlanId, ids: [btId] },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('assigns plan and returns count', async () => {
    await postExpectCount(POST, { planId, ids: [btId] }, 1)
  })

  it('accepts null planId (unassign)', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { planId: null, ids: [btId] },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
  })
})
