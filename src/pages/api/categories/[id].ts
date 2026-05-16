import type { APIRoute } from 'astro'
import {
  deleteCategory,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
} from '@/lib/categories'
import { error, json, requireExisting, validateBody } from '@/lib/api/responses'
import { updateCategorySchema } from './_schema'

async function ensureSlugAvailable(
  nextSlug: string | undefined,
  currentSlug: string,
): Promise<Response | null> {
  if (!nextSlug || nextSlug === currentSlug) return null
  const slugExists = await getCategoryBySlug(nextSlug)
  if (slugExists) {
    return error('Eine Kategorie mit diesem Slug existiert bereits', 409)
  }
  return null
}

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

  const slugError = await ensureSlugAvailable(data.slug, found.resource.slug)
  if (slugError) return slugError

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
