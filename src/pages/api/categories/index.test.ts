import { describe, expect, it } from 'bun:test'
import { seedCategory } from '@/lib/__fixtures__/seeds'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'

const testDb = setupTestDb()

const { GET, POST } = await import('./index')

async function insertCategory(id: string, name: string, slug = id) {
  await seedCategory(testDb, { id, name, slug })
}

describe('GET /api/categories', () => {
  it('returns all categories when no search', async () => {
    await insertCategory('a', 'Alpha')
    await insertCategory('b', 'Beta')
    const res = (await GET(buildApiContext() as never)) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.categories.map((c: { name: string }) => c.name)).toEqual([
      'Alpha',
      'Beta',
    ])
  })

  it('filters by search query', async () => {
    await insertCategory('a', 'Miete')
    await insertCategory('b', 'Lebensmittel')
    const res = (await GET(
      buildApiContext({
        url: 'http://test/api/categories?search=miete',
      }) as never,
    )) as Response
    const body = await res.json()
    expect(body.categories.map((c: { name: string }) => c.name)).toEqual([
      'Miete',
    ])
  })
})

describe('POST /api/categories', () => {
  it('rejects missing name', async () => {
    const res = (await POST(
      buildApiContext({ method: 'POST', body: {} }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('rejects invalid slug format', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { name: 'X', slug: 'BAD SLUG' },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('rejects invalid color format', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { name: 'X', color: 'red' },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('rejects duplicate slug', async () => {
    await insertCategory('a', 'Existing', 'taken')
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { name: 'New', slug: 'taken' },
      }) as never,
    )) as Response
    expect(res.status).toBe(409)
  })

  it('auto-generates slug from name when not provided', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { name: 'Lebensmittel' },
      }) as never,
    )) as Response
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.slug).toBe('lebensmittel')
  })

  it('creates with explicit slug and color', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { name: 'Miete', slug: 'rent', color: '#ff0000' },
      }) as never,
    )) as Response
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.slug).toBe('rent')
    expect(body.color).toBe('#ff0000')
  })
})
