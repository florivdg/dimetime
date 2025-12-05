import type { APIRoute } from 'astro'
import { z } from 'zod'
import { db } from '@/db/database'
import { plan, plannedTransaction } from '@/db/schema/plans'
import { inArray } from 'drizzle-orm'
import type { ImportResult } from '@/lib/import'

const importPlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().nullable(),
  isArchived: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const importTransactionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  note: z.string().nullable(),
  type: z.enum(['income', 'expense']),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().int().min(0),
  isDone: z.boolean(),
  completedAt: z.number().nullable(),
  planId: z.string().uuid(),
  userId: z.string(),
  categoryId: z.string().uuid().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const importRequestSchema = z.object({
  plans: z.array(importPlanSchema),
  transactions: z.array(importTransactionSchema),
})

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

  const parsed = importRequestSchema.safeParse(body)
  if (!parsed.success) {
    const errors = parsed.error.issues
      .slice(0, 3)
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ')
    return new Response(
      JSON.stringify({ error: `Validierungsfehler: ${errors}` }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  const { plans: plansToImport, transactions: transactionsToImport } =
    parsed.data

  const result: ImportResult = {
    plansImported: 0,
    plansSkipped: 0,
    transactionsImported: 0,
    transactionsSkipped: 0,
  }

  try {
    // 1. Check for existing plan IDs
    const planIds = plansToImport.map((p) => p.id)
    const existingPlans =
      planIds.length > 0
        ? await db.query.plan.findMany({
            columns: { id: true },
            where: inArray(plan.id, planIds),
          })
        : []
    const existingPlanIds = new Set(existingPlans.map((p) => p.id))

    // 2. Filter out existing plans (skip duplicates)
    const newPlans = plansToImport.filter((p) => !existingPlanIds.has(p.id))
    result.plansSkipped = plansToImport.length - newPlans.length

    // 3. Insert new plans in batches
    if (newPlans.length > 0) {
      const planValues = newPlans.map((p) => ({
        id: p.id,
        name: p.name,
        date: p.date,
        notes: p.notes,
        isArchived: p.isArchived,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      }))

      // Insert in batches of 100
      const BATCH_SIZE = 100
      for (let i = 0; i < planValues.length; i += BATCH_SIZE) {
        const batch = planValues.slice(i, i + BATCH_SIZE)
        await db.insert(plan).values(batch)
      }
      result.plansImported = newPlans.length
    }

    // 4. Check for existing transaction IDs
    const transactionIds = transactionsToImport.map((t) => t.id)
    const existingTransactions =
      transactionIds.length > 0
        ? await db.query.plannedTransaction.findMany({
            columns: { id: true },
            where: inArray(plannedTransaction.id, transactionIds),
          })
        : []
    const existingTransactionIds = new Set(
      existingTransactions.map((t) => t.id),
    )

    // 5. Filter out existing transactions (skip duplicates)
    const newTransactions = transactionsToImport.filter(
      (t) => !existingTransactionIds.has(t.id),
    )
    result.transactionsSkipped =
      transactionsToImport.length - newTransactions.length

    // 6. Insert new transactions in batches
    if (newTransactions.length > 0) {
      const transactionValues = newTransactions.map((t) => ({
        id: t.id,
        name: t.name,
        note: t.note,
        type: t.type,
        dueDate: t.dueDate,
        amount: t.amount,
        isDone: t.isDone,
        completedAt: t.completedAt ? new Date(t.completedAt) : null,
        planId: t.planId,
        userId: t.userId,
        categoryId: t.categoryId,
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
      }))

      // Insert in batches of 100
      const BATCH_SIZE = 100
      for (let i = 0; i < transactionValues.length; i += BATCH_SIZE) {
        const batch = transactionValues.slice(i, i + BATCH_SIZE)
        await db.insert(plannedTransaction).values(batch)
      }
      result.transactionsImported = newTransactions.length
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Import error:', error)
    const message =
      error instanceof Error ? error.message : 'Unbekannter Fehler'
    return new Response(
      JSON.stringify({ error: `Import fehlgeschlagen: ${message}` }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
