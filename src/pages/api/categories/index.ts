import type { APIRoute } from 'astro'
import {
  createCategory,
  generateSlug,
  getAllCategories,
  getCategoryBySlug,
  searchCategories,
} from '@/lib/categories'
import { error, json, validateBody } from '@/lib/api/responses'
import { createCategorySchema } from './_schema'

export const GET: APIRoute = async ({ url }) => {
  const search = url.searchParams.get('search')

  const categories = search
    ? await searchCategories(search)
    : await getAllCategories()

  return json({ categories })
}

export const POST: APIRoute = async ({ request }) => {
  const data = await validateBody(request, createCategorySchema)
  if (data instanceof Response) return data

  const { name, color } = data
  const slug = data.slug || generateSlug(name)

  // Check for duplicate slug
  const existing = await getCategoryBySlug(slug)
  if (existing) {
    return error('Eine Kategorie mit diesem Slug existiert bereits', 409)
  }

  const category = await createCategory({ name, slug, color })

  return json(category, 201)
}
