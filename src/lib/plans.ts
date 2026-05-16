import { db } from '@/db/database'
import { plan } from '@/db/schema/plans'
import { and, desc, eq, like, or } from 'drizzle-orm'
import { buildSetValues } from '@/lib/db/partial-update'

// Infer types from Drizzle schema
export type Plan = typeof plan.$inferSelect
export type NewPlan = typeof plan.$inferInsert

// Omit auto-managed fields for create/update inputs
export type CreatePlanInput = Omit<NewPlan, 'id' | 'createdAt' | 'updatedAt'>
export type UpdatePlanInput = Partial<CreatePlanInput>

function buildPlanConditions(
  includeArchived: boolean,
  year: number | undefined,
) {
  const conditions = []
  if (!includeArchived) conditions.push(eq(plan.isArchived, false))
  if (year !== undefined) conditions.push(like(plan.date, `${year}-%`))
  return conditions
}

/**
 * Get all distinct years from plans (sorted descending)
 */
export async function getAvailableYears(): Promise<number[]> {
  const plans = await db.query.plan.findMany({
    columns: { date: true },
  })

  const years = new Set<number>()
  plans.forEach((p) => {
    const year = parseInt(p.date.substring(0, 4), 10)
    if (!isNaN(year)) {
      years.add(year)
    }
  })

  return Array.from(years).sort((a, b) => b - a)
}

/**
 * Get all plans ordered by date (newest first)
 * @param includeArchived - Whether to include archived plans (default: false)
 * @param year - Optional year to filter by
 */
export async function getAllPlans(
  includeArchived = false,
  year?: number,
): Promise<Plan[]> {
  const conditions = buildPlanConditions(includeArchived, year)

  if (conditions.length === 0) {
    return db.query.plan.findMany({
      orderBy: desc(plan.date),
    })
  }

  return db.query.plan.findMany({
    where: conditions.length === 1 ? conditions[0] : and(...conditions),
    orderBy: desc(plan.date),
  })
}

/**
 * Search plans by name (case-insensitive partial match)
 * @param query - Search query string
 * @param includeArchived - Whether to include archived plans (default: false)
 * @param year - Optional year to filter by
 */
export async function searchPlans(
  query: string,
  includeArchived = false,
  year?: number,
): Promise<Plan[]> {
  const conditions = [
    or(like(plan.name, `%${query}%`), like(plan.date, `%${query}%`)),
    ...buildPlanConditions(includeArchived, year),
  ]

  return db.query.plan.findMany({
    where: and(...conditions),
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
  const updateData = buildSetValues<typeof input, NewPlan>(input, {
    name: (v, s) => {
      s.name = v
    },
    date: (v, s) => {
      s.date = v
    },
    notes: (v, s) => {
      s.notes = v
    },
    isArchived: (v, s) => {
      s.isArchived = v
    },
  })

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

/**
 * Get the plan for the current month (if it exists)
 */
export async function getCurrentMonthPlan(): Promise<Plan | undefined> {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  return db.query.plan.findFirst({
    where: and(
      like(plan.date, `${currentMonth}-%`),
      eq(plan.isArchived, false),
    ),
  })
}

/**
 * Get the latest (most recent by date) non-archived plan
 */
async function getLatestPlan(): Promise<Plan | undefined> {
  return db.query.plan.findFirst({
    where: eq(plan.isArchived, false),
    orderBy: desc(plan.date),
  })
}

/**
 * Get sidebar plan data (current month + latest plan)
 */
export async function getSidebarPlans() {
  const [currentMonth, latest] = await Promise.all([
    getCurrentMonthPlan(),
    getLatestPlan(),
  ])
  return { currentMonth, latest }
}
