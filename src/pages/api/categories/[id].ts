import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  deleteCategory,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
} from '@/lib/categories'
import { error, json, parseJson, validate } from '@/lib/api/responses'

const updateCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Name ist erforderlich')
    .max(100, 'Name ist zu lang')
    .optional(),
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

export const PUT: APIRoute = async ({ params, request }) => {
  const { id } = params
  if (!id) return error('Kategorie-ID ist erforderlich', 400)

  const existing = await getCategoryById(id)
  if (!existing) return error('Kategorie nicht gefunden', 404)

  const body = await parseJson(request)
  if (body instanceof Response) return body

  const data = validate(updateCategorySchema, body)
  if (data instanceof Response) return data

  // Check for duplicate slug if slug is being updated
  if (data.slug && data.slug !== existing.slug) {
    const slugExists = await getCategoryBySlug(data.slug)
    if (slugExists) {
      return error('Eine Kategorie mit diesem Slug existiert bereits', 409)
    }
  }

  const updated = await updateCategory(id, data)

  return json(updated)
}

export const DELETE: APIRoute = async ({ params }) => {
  const { id } = params
  if (!id) return error('Kategorie-ID ist erforderlich', 400)

  const existing = await getCategoryById(id)
  if (!existing) return error('Kategorie nicht gefunden', 404)

  await deleteCategory(id)

  return json({ success: true, message: 'Kategorie wurde gelöscht' })
}
