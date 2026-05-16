import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as plansSchema from '@/db/schema/plans'
import { createTestDb } from '@/lib/__fixtures__/test-db'
import { buildApiContext } from '@/lib/__fixtures__/api-context'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const { PUT, DELETE } = await import('./[id]')

const now = new Date('2026-03-09T00:00:00.000Z')

async function insertCategory(id: string, slug: string, name = id) {
  await testDb.insert(plansSchema.category).values({
    id,
    name,
    slug,
    createdAt: now,
    updatedAt: now,
  })
}

beforeEach(() => {
  harness.reset()
})

afterAll(() => {
  harness.close()
})

describe('PUT /api/categories/[id]', () => {
  it('returns 400 when id missing', async () => {
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { name: 'X' },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 404 when not found', async () => {
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { name: 'X' },
        params: { id: 'missing' },
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('returns 409 when slug change conflicts with existing', async () => {
    await insertCategory('cat-1', 'rent')
    await insertCategory('cat-2', 'food')
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { slug: 'food' },
        params: { id: 'cat-1' },
      }) as never,
    )) as Response
    expect(res.status).toBe(409)
  })

  it('allows keeping the same slug', async () => {
    await insertCategory('cat-1', 'rent')
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { name: 'New', slug: 'rent' },
        params: { id: 'cat-1' },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
  })

  it('updates and returns the new category', async () => {
    await insertCategory('cat-1', 'rent', 'Old')
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { name: 'New' },
        params: { id: 'cat-1' },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('New')
  })
})

describe('DELETE /api/categories/[id]', () => {
  it('returns 404 when not found', async () => {
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: 'missing' },
      }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })

  it('returns 400 when no id', async () => {
    const res = (await DELETE(
      buildApiContext({ method: 'DELETE' }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('deletes and returns success', async () => {
    await insertCategory('cat-1', 'rent')
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: 'cat-1' },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})
