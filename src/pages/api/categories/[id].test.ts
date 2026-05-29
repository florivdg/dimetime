import { describe, expect, it } from 'bun:test'
import { seedCategory } from '@/lib/__fixtures__/seeds'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import { itGuardsIdRoute } from '@/lib/__fixtures__/route-guards'

const testDb = setupTestDb()

const { PUT, DELETE } = await import('./[id]')

async function insertCategory(id: string, slug: string, name = id) {
  await seedCategory(testDb, { id, name, slug })
}

describe('PUT /api/categories/[id]', () => {
  itGuardsIdRoute(PUT, {
    method: 'PUT',
    body: { name: 'X' },
    unknownId: 'missing',
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
  itGuardsIdRoute(DELETE, { method: 'DELETE', unknownId: 'missing' })

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
