import type { APIRoute } from 'astro'
import { z } from 'zod'
import { db } from '@/db/database'
import { bulkArchiveBankTransactions } from '@/lib/bank-transactions'
import { bulkArchiveSplits } from '@/lib/bank-transaction-splits'
import { jsonResponse, jsonError } from '@/lib/bank-import/api-helpers'

const bulkArchiveSchema = z
  .object({
    ids: z.array(z.uuid()).max(100).default([]),
    splitIds: z.array(z.uuid()).max(100).default([]),
    isArchived: z.boolean(),
  })
  .refine((data) => data.ids.length > 0 || data.splitIds.length > 0, {
    message: 'Mindestens eine Transaktions- oder Split-ID ist erforderlich',
  })

export const POST: APIRoute = async ({ request }) => {
  let body
  try {
    body = await request.json()
  } catch {
    return jsonError('Ungültiger Request-Body', 400)
  }

  const parsed = bulkArchiveSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Ungültige Daten', 400)
  }

  try {
    const count = db.transaction((tx) => {
      // bun-sqlite commits when this callback returns; it must stay synchronous.
      const txCount =
        parsed.data.ids.length > 0
          ? bulkArchiveBankTransactions(
              parsed.data.ids,
              parsed.data.isArchived,
              tx,
            )
          : 0
      const splitCount =
        parsed.data.splitIds.length > 0
          ? bulkArchiveSplits(parsed.data.splitIds, parsed.data.isArchived, tx)
          : 0
      return txCount + splitCount
    })

    return jsonResponse({ success: true, count })
  } catch (error) {
    console.error('Error bulk archiving bank transactions:', error)
    return jsonError('Fehler beim Archivieren der Transaktionen', 500)
  }
}
