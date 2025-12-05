import { db } from '@/db/database'
import { plan } from '@/db/schema/plans'
import { and, desc, eq, like, or } from 'drizzle-orm'

// Infer types from Drizzle schema
export type Plan = typeof plan.$inferSelect
export type NewPlan = typeof plan.$inferInsert

// Omit auto-managed fields for create/update inputs
export type CreatePlanInput = Omit<NewPlan, 'id' | 'createdAt' | 'updatedAt'>
export type UpdatePlanInput = Partial<CreatePlanInput>

/**
 * Get all plans ordered by date (newest first)
 * @param includeArchived - Whether to include archived plans (default: false)
 */
export async function getAllPlans(includeArchived = false): Promise<Plan[]> {
  if (includeArchived) {
    return db.query.plan.findMany({
      orderBy: desc(plan.date),
    })
  }
  return db.query.plan.findMany({
    where: eq(plan.isArchived, false),
    orderBy: desc(plan.date),
  })
}

/**
 * Search plans by name (case-insensitive partial match)
 * @param query - Search query string
 * @param includeArchived - Whether to include archived plans (default: false)
 */
export async function searchPlans(
  query: string,
  includeArchived = false,
): Promise<Plan[]> {
  const searchCondition = or(
    like(plan.name, `%${query}%`),
    like(plan.date, `%${query}%`),
  )

  if (includeArchived) {
    return db.query.plan.findMany({
      where: searchCondition,
      orderBy: desc(plan.date),
    })
  }

  return db.query.plan.findMany({
    where: and(eq(plan.isArchived, false), searchCondition),
    orderBy: desc(plan.date),
  })
}

/**
 * Get a single plan by ID
 */
export async function getPlanById(id: string): Promise<Plan | undefined> {
  return db.query.plan.findFirst({
    where: eq(plan.id, id),
  })
}

/**
 * Create a new plan
 */
export async function createPlan(input: CreatePlanInput): Promise<Plan> {
  const now = new Date()
  const result = await db
    .insert(plan)
    .values({
      name: input.name ?? null,
      date: input.date,
      notes: input.notes ?? null,
      isArchived: input.isArchived ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  return result[0]
}

/**
 * Update an existing plan
 */
export async function updatePlan(
  id: string,
  input: UpdatePlanInput,
): Promise<Plan | undefined> {
  const updateData: {
    name?: string | null
    date?: string
    notes?: string | null
    isArchived?: boolean
    updatedAt: Date
  } = {
    updatedAt: new Date(),
  }

  if (input.name !== undefined) updateData.name = input.name
  if (input.date !== undefined) updateData.date = input.date
  if (input.notes !== undefined) updateData.notes = input.notes
  if (input.isArchived !== undefined) updateData.isArchived = input.isArchived

  const result = await db
    .update(plan)
    .set(updateData)
    .where(eq(plan.id, id))
    .returning()

  return result[0]
}

/**
 * Delete a plan by ID
 */
export async function deletePlan(id: string): Promise<boolean> {
  const result = await db
    .delete(plan)
    .where(eq(plan.id, id))
    .returning({ id: plan.id })
  return result.length > 0
}
