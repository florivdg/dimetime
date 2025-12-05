import type { APIRoute } from 'astro'
import { z } from 'zod'
import {
  createCategory,
  generateSlug,
  getAllCategories,
  getCategoryBySlug,
  searchCategories,
} from '@/lib/categories'

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

  return new Response(JSON.stringify({ categories }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ request }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültiges JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const parsed = createCategorySchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0].message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { name, color } = parsed.data
  const slug = parsed.data.slug || generateSlug(name)

  // Check for duplicate slug
  const existing = await getCategoryBySlug(slug)
  if (existing) {
    return new Response(
      JSON.stringify({
        error: 'Eine Kategorie mit diesem Slug existiert bereits',
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const category = await createCategory({ name, slug, color })

  return new Response(JSON.stringify(category), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}
