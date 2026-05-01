import type { APIRoute } from 'astro'
import {
  deleteCategory,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
} from '@/lib/categories'
import { error, json, requireExisting, validateBody } from '@/lib/api/responses'
import { updateCategorySchema } from './_schema'

export const PUT: APIRoute = async ({ params, request }) => {
  const found = await requireExisting(
    params,
    'id',
    'Kategorie-ID',
    getCategoryById,
    'Kategorie nicht gefunden',
  )
  if (found instanceof Response) return found

  const data = await validateBody(request, updateCategorySchema)
  if (data instanceof Response) return data

  if (data.slug && data.slug !== found.resource.slug) {
    const slugExists = await getCategoryBySlug(data.slug)
    if (slugExists) {
      return error('Eine Kategorie mit diesem Slug existiert bereits', 409)
    }
  }

  const updated = await updateCategory(found.id, data)

  return json(updated)
}

export const DELETE: APIRoute = async ({ params }) => {
  const found = await requireExisting(
    params,
    'id',
    'Kategorie-ID',
    getCategoryById,
    'Kategorie nicht gefunden',
  )
  if (found instanceof Response) return found

  await deleteCategory(found.id)

  return json({ success: true, message: 'Kategorie wurde gelöscht' })
}
