import type { APIRoute } from 'astro'
import { previewBankImport } from '@/lib/bank-import/service'
import { runImportFlow } from '@/lib/bank-import/api-helpers'

export const POST: APIRoute = async ({ request, locals }) =>
  runImportFlow(request, locals.user?.id ?? null, previewBankImport)
