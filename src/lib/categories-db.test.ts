import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as plansSchema from '@/db/schema/plans'
import { createTestDb } from '@/lib/__fixtures__/test-db'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const {
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById,
  getCategoryBySlug,
  searchCategories,
  updateCategory,
} = await import('./categories')

const now = new Date('2026-03-09T00:00:00.000Z')

async function insertCategory(
  id: string,
  name: string,
  slug = id,
  color: string | null = null,
) {
  await testDb.insert(plansSchema.category).values({
    id,
    name,
    slug,
    color,
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

describe('createCategory', () => {
  it('persists with provided fields', async () => {
    const created = await createCategory({
      name: 'Miete',
      slug: 'miete',
      color: '#ff0000',
    })
    expect(created.name).toBe('Miete')
    expect(created.slug).toBe('miete')
    expect(created.color).toBe('#ff0000')
  })

  it('defaults color to null when not provided', async () => {
    const created = await createCategory({ name: 'Food', slug: 'food' })
    expect(created.color).toBeNull()
  })
})

describe('getAllCategories', () => {
  it('returns categories sorted alphabetically by name', async () => {
    await insertCategory('a', 'Zebra')
    await insertCategory('b', 'Alpha')
    await insertCategory('c', 'Mango')
    const all = await getAllCategories()
    expect(all.map((c) => c.name)).toEqual(['Alpha', 'Mango', 'Zebra'])
  })

  it('returns empty list when nothing exists', async () => {
    expect(await getAllCategories()).toEqual([])
  })
})

describe('searchCategories', () => {
  it('matches partial name via LIKE', async () => {
    await insertCategory('a', 'Lebensmittel')
    await insertCategory('b', 'Lebensversicherung')
    await insertCategory('c', 'Sonstiges')
    const result = await searchCategories('Lebens')
    expect(result.map((c) => c.id).sort()).toEqual(['a', 'b'])
  })

  it('returns empty for no matches', async () => {
    await insertCategory('a', 'Miete')
    expect(await searchCategories('xyz')).toEqual([])
  })
})

describe('getCategoryById', () => {
  it('returns the matching category', async () => {
    await insertCategory('cat-1', 'Miete')
    expect((await getCategoryById('cat-1'))?.name).toBe('Miete')
  })

  it('returns undefined for unknown id', async () => {
    expect(await getCategoryById('missing')).toBeUndefined()
  })
})

describe('getCategoryBySlug', () => {
  it('returns by slug', async () => {
    await insertCategory('cat-1', 'Miete', 'rent')
    expect((await getCategoryBySlug('rent'))?.id).toBe('cat-1')
  })

  it('returns undefined for unknown slug', async () => {
    expect(await getCategoryBySlug('nope')).toBeUndefined()
  })
})

describe('updateCategory', () => {
  it('updates the provided fields only', async () => {
    await insertCategory('cat-1', 'Old', 'old-slug', '#abc')
    const updated = await updateCategory('cat-1', { name: 'New' })
    expect(updated?.name).toBe('New')
    expect(updated?.slug).toBe('old-slug')
    expect(updated?.color).toBe('#abc')
  })

  it('allows clearing color via null', async () => {
    await insertCategory('cat-1', 'X', 'x', '#fff')
    const updated = await updateCategory('cat-1', { color: null })
    expect(updated?.color).toBeNull()
  })

  it('returns undefined for missing id', async () => {
    expect(await updateCategory('missing', { name: 'x' })).toBeUndefined()
  })
})

describe('deleteCategory', () => {
  it('returns true when removed', async () => {
    await insertCategory('cat-1', 'X')
    expect(await deleteCategory('cat-1')).toBe(true)
    expect(await getCategoryById('cat-1')).toBeUndefined()
  })

  it('returns false for unknown id', async () => {
    expect(await deleteCategory('missing')).toBe(false)
  })
})
