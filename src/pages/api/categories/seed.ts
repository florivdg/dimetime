import type { APIRoute } from 'astro'
import { createCategory, getCategoryBySlug } from '@/lib/categories'

const DEFAULT_CATEGORIES = [
  { name: 'Einkommen', slug: 'einkommen', color: '#22c55e' },
  { name: 'Miete', slug: 'miete', color: '#f97316' },
  { name: 'Lebensmittel', slug: 'lebensmittel', color: '#eab308' },
  { name: 'Transport', slug: 'transport', color: '#3b82f6' },
  { name: 'Versicherungen', slug: 'versicherungen', color: '#a855f7' },
  { name: 'Kommunikation', slug: 'kommunikation', color: '#06b6d4' },
  { name: 'Unterhaltung', slug: 'unterhaltung', color: '#ec4899' },
  { name: 'Gesundheit', slug: 'gesundheit', color: '#ef4444' },
  { name: 'Kleidung', slug: 'kleidung', color: '#6366f1' },
  { name: 'Abonnements', slug: 'abonnements', color: '#f59e0b' },
  { name: 'Haushalt', slug: 'haushalt', color: '#14b8a6' },
  { name: 'Bildung', slug: 'bildung', color: '#8b5cf6' },
  { name: 'Sparen', slug: 'sparen', color: '#10b981' },
  { name: 'Geschenke', slug: 'geschenke', color: '#f43f5e' },
  { name: 'Sonstiges', slug: 'sonstiges', color: '#6b7280' },
]

export const POST: APIRoute = async () => {
  let inserted = 0
  let skipped = 0

  for (const cat of DEFAULT_CATEGORIES) {
    const existing = await getCategoryBySlug(cat.slug)
    if (existing) {
      skipped++
      continue
    }
    await createCategory(cat)
    inserted++
  }

  return new Response(JSON.stringify({ inserted, skipped }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
