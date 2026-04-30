import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  createCategory,
  generateSlug,
  getAllCategories,
  getCategoryBySlug,
  searchCategories,
} from '@/lib/categories'
import { error, json, parseJson, validate } from '@/lib/api/responses'

const createCategorySchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(100, 'Name ist zu lang'),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9-]+$/,
      'Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten',
    )
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Ungültiges Farbformat (z.B. #FF5733)')
    .nullable()
    .optional(),
})

export const GET: APIRoute = async ({ url }) => {
  const search = url.searchParams.get('search')

  const categories = search
    ? await searchCategories(search)
    : await getAllCategories()

  return json({ categories })
}

export const POST: APIRoute = async ({ request }) => {
  const body = await parseJson(request)
  if (body instanceof Response) return body

  const data = validate(createCategorySchema, body)
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
