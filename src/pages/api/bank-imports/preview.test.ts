import { beforeEach, describe, expect, it } from 'bun:test'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import {
  buildImportFormData,
  seedImportSource,
  seedUser,
} from '@/lib/__fixtures__/seeds'
import { makeCsvFile } from '@/lib/__fixtures__/sample-csv'

const testDb = setupTestDb()

const { POST } = await import('./preview')

const sourceId = 'src-1'

beforeEach(async () => {
  await seedImportSource(testDb, { id: sourceId, name: 'ING' })
  await seedUser(testDb, { id: 'user-1' })
})

describe('POST /api/bank-imports/preview', () => {
  it('rejects non-multipart bodies', async () => {
    const request = new Request('http://test/api/bank-imports/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const res = (await POST({ request, locals: {} } as never)) as Response
    expect(res.status).toBe(400)
  })

  it('rejects when sourceId missing', async () => {
    const file = makeCsvFile()
    const res = (await POST({
      request: buildImportFormData('/api/bank-imports/preview', { file }),
      locals: {},
    } as never)) as Response
    expect(res.status).toBe(400)
  })

  it('rejects unknown source id', async () => {
    const file = makeCsvFile()
    const res = (await POST({
      request: buildImportFormData('/api/bank-imports/preview', {
        sourceId: 'missing',
        file,
      }),
      locals: {},
    } as never)) as Response
    expect(res.status).toBe(404)
  })

  it('returns 200 preview result on success', async () => {
    const file = makeCsvFile()
    const res = (await POST({
      request: buildImportFormData('/api/bank-imports/preview', {
        sourceId,
        file,
      }),
      locals: { user: { id: 'user-1' } },
    } as never)) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.source.id).toBe(sourceId)
    expect(body.counts.totalRows).toBeGreaterThan(0)
  })
})
