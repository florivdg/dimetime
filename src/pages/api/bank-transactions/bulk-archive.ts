import type { APIRoute } from 'astro'
import { z } from 'zod'
import { bulkArchiveBankTransactions } from '@/lib/bank-transactions'

const bulkArchiveSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(100),
  isArchived: z.boolean(),
})

export const POST: APIRoute = async ({ request }) => {
  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Ungültiger Request-Body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const parsed = bulkArchiveSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0]?.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const count = await bulkArchiveBankTransactions(
      parsed.data.ids,
      parsed.data.isArchived,
    )

    return new Response(JSON.stringify({ success: true, count }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error bulk archiving bank transactions:', error)
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Fehler beim Archivieren der Transaktionen',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
