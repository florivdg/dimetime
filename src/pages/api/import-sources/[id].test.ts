import { describe, expect, it } from 'bun:test'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import {
  itGuardsIdRoute,
  itUpdatesViaPut,
} from '@/lib/__fixtures__/route-guards'
import { seedBankTransaction, seedImportSource } from '@/lib/__fixtures__/seeds'

const testDb = setupTestDb()

const { PUT, DELETE } = await import('./[id]')

const sourceId = 'src-1'

async function seedSource() {
  await seedImportSource(testDb, {
    id: sourceId,
    name: 'Source',
    defaultPlanAssignment: 'auto_month',
  })
}

describe('PUT /api/import-sources/[id]', () => {
  itGuardsIdRoute(PUT, {
    method: 'PUT',
    body: { name: 'X' },
    unknownId: 'missing',
  })

  itUpdatesViaPut(PUT, {
    seed: seedSource,
    id: sourceId,
    invalidBody: { preset: 'bogus' },
    resourceName: 'source',
  })
})

describe('DELETE /api/import-sources/[id]', () => {
  itGuardsIdRoute(DELETE, { method: 'DELETE', unknownId: 'missing' })

  it('returns 409 when bank transactions reference the source', async () => {
    await seedSource()
    await seedBankTransaction(testDb, {
      id: 'bt-1',
      sourceId,
      amountCents: -100,
    })
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: sourceId },
      }) as never,
    )) as Response
    expect(res.status).toBe(409)
  })

  it('deletes successfully when not referenced', async () => {
    await seedSource()
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: sourceId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
  })
})
