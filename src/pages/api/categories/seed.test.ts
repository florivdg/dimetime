import { describe, expect, it } from 'bun:test'
import { seedCategory } from '@/lib/__fixtures__/seeds'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'

const testDb = setupTestDb()

const { POST } = await import('./seed')

describe('POST /api/categories/seed', () => {
  it('inserts all defaults when no categories exist', async () => {
    const res = (await POST(
      buildApiContext({ method: 'POST' }) as never,
    )) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.inserted).toBeGreaterThan(0)
    expect(body.skipped).toBe(0)
    const cats = await testDb.query.category.findMany({})
    expect(cats.length).toBe(body.inserted)
  })

  it('skips existing slugs and reports them', async () => {
    await seedCategory(testDb, { id: 'pre', name: 'Miete', slug: 'miete' })
    const res = (await POST(
      buildApiContext({ method: 'POST' }) as never,
    )) as Response
    const body = await res.json()
    expect(body.skipped).toBeGreaterThanOrEqual(1)
  })
})
