import { describe, expect, it } from 'bun:test'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import {
  itGuardsIdRoute,
  itUpdatesViaPut,
} from '@/lib/__fixtures__/route-guards'
import { seedPlan } from '@/lib/__fixtures__/seeds'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'

const testDb = setupTestDb()
const { PUT, DELETE } = await import('./[id]')

const planId = 'p1'

describe('PUT /api/plans/[id]', () => {
  itGuardsIdRoute(PUT, {
    method: 'PUT',
    body: { name: 'X' },
    unknownId: 'missing',
  })

  itUpdatesViaPut(PUT, {
    seed: () => seedPlan(testDb).then(() => undefined),
    id: planId,
    invalidBody: { date: '2026/03/01' },
    resourceName: 'plan',
  })
})

describe('DELETE /api/plans/[id]', () => {
  itGuardsIdRoute(DELETE, { method: 'DELETE', unknownId: 'missing' })

  it('deletes and returns success', async () => {
    await seedPlan(testDb)
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: planId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
  })
})
