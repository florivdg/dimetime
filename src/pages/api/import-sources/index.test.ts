import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as plansSchema from '@/db/schema/plans'
import { createTestDb } from '@/lib/__fixtures__/test-db'
import { buildApiContext } from '@/lib/__fixtures__/api-context'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const { GET, POST } = await import('./index')

const now = new Date('2026-03-09T00:00:00.000Z')

beforeEach(() => {
  harness.reset()
})

afterAll(() => {
  harness.close()
})

describe('GET /api/import-sources', () => {
  it('returns an empty list when none exist', async () => {
    const res = (await GET(buildApiContext() as never)) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sources).toEqual([])
  })

  it('returns existing sources', async () => {
    await testDb.insert(plansSchema.importSource).values({
      id: 'src-1',
      name: 'ING',
      preset: 'ing_csv_v1',
      sourceKind: 'bank_account',
      defaultPlanAssignment: 'auto_month',
      isActive: true,
      createdAt: now,
      updatedAt: now,
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
