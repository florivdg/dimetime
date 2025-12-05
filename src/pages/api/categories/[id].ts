import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  deleteCategory,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
} from '@/lib/categories'

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

  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Kategorie-ID ist erforderlich' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const existing = await getCategoryById(id)
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Kategorie nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültiges JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const parsed = updateCategorySchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0].message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Check for duplicate slug if slug is being updated
  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    const slugExists = await getCategoryBySlug(parsed.data.slug)
    if (slugExists) {
      return new Response(
        JSON.stringify({
          error: 'Eine Kategorie mit diesem Slug existiert bereits',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  const updated = await updateCategory(id, parsed.data)

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const DELETE: APIRoute = async ({ params }) => {
  const { id } = params

  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Kategorie-ID ist erforderlich' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const existing = await getCategoryById(id)
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Kategorie nicht gefunden' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await deleteCategory(id)

  return new Response(
    JSON.stringify({ success: true, message: 'Kategorie wurde gelöscht' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}
