import { describe, expect, it } from 'bun:test'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import { seedImportSource } from '@/lib/__fixtures__/seeds'

const testDb = setupTestDb()

const { GET, POST } = await import('./index')

describe('GET /api/import-sources', () => {
  it('returns an empty list when none exist', async () => {
    const res = (await GET(buildApiContext() as never)) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sources).toEqual([])
  })

  it('returns existing sources', async () => {
    await seedImportSource(testDb, {
      id: 'src-1',
      name: 'ING',
      defaultPlanAssignment: 'auto_month',
    })
    const res = (await GET(buildApiContext() as never)) as Response
    const body = await res.json()
    expect(body.sources).toHaveLength(1)
  })
})

describe('POST /api/import-sources', () => {
  it('rejects invalid JSON', async () => {
    const res = (await POST(
      buildApiContext({ method: 'POST', bodyText: '{not-json' }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('rejects invalid preset enum value', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { name: 'X', preset: 'bogus', sourceKind: 'bank_account' },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('creates and returns 201', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: {
          name: 'ING Main',
          preset: 'ing_csv_v1',
          sourceKind: 'bank_account',
        },
      }) as never,
    )) as Response
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('ING Main')
  })
})
