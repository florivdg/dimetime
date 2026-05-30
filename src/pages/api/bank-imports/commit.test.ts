import { beforeEach, describe, expect, it } from 'bun:test'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import {
  buildImportFormData,
  seedImportSource,
  seedUser,
} from '@/lib/__fixtures__/seeds'
import { makeCsvFile } from '@/lib/__fixtures__/sample-csv'

const testDb = setupTestDb()

const { POST } = await import('./commit')

const sourceId = 'src-1'

beforeEach(async () => {
  await seedImportSource(testDb, { id: sourceId, name: 'ING' })
  await seedUser(testDb, { id: 'user-1' })
})

describe('POST /api/bank-imports/commit', () => {
  it('persists rows on success', async () => {
    const res = (await POST({
      request: buildImportFormData('/api/bank-imports/commit', {
        sourceId,
        file: makeCsvFile(),
      }),
      locals: { user: { id: 'user-1' } },
    } as never)) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.inserted).toBeGreaterThan(0)
    expect(body.importId).toBeTypeOf('string')
  })

  it('returns error response when parsing fails', async () => {
    const file = new File(['garbage'], 'statement.csv', { type: 'text/csv' })
    const res = (await POST({
      request: buildImportFormData('/api/bank-imports/commit', {
        sourceId,
        file,
      }),
      locals: {},
    } as never)) as Response
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
