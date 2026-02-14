import { db } from '@/db/database'
import { transactionPreset, category } from '@/db/schema/plans'
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  like,
  sql,
} from 'drizzle-orm'
import { createTransaction, type CreateTransactionInput } from './transactions'
import { getPlanById } from './plans'

// Infer types from Drizzle schema
export type TransactionPreset = typeof transactionPreset.$inferSelect
export type NewTransactionPreset = typeof transactionPreset.$inferInsert

// Preset with enriched data for display
export type PresetWithTags = TransactionPreset & {
  categoryName: string | null
  categoryColor: string | null
}

// Pagination response type
export interface PaginatedPresets {
  presets: PresetWithTags[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// Query options type
export interface PresetQueryOptions {
  search?: string
  type?: 'income' | 'expense'
  categoryId?: string
  recurrence?: 'einmalig' | 'monatlich' | 'vierteljährlich' | 'jährlich'
  includeExpired?: boolean
  sortBy?: 'name' | 'createdAt' | 'lastUsedAt' | 'amount'
  sortDir?: 'asc' | 'desc'
  page?: number
  limit?: number
}

// Create input type
export interface CreatePresetInput {
  name: string
  note?: string | null
  type?: 'income' | 'expense'
  amount: number
  recurrence?: 'einmalig' | 'monatlich' | 'vierteljährlich' | 'jährlich'
  startMonth?: string | null // YYYY-MM format
  endDate?: string | null
  categoryId?: string | null
  dayOfMonth?: number | null // 1-31
}

// Update input type
export interface UpdatePresetInput {
  name?: string
  note?: string | null
  type?: 'income' | 'expense'
  amount?: number
  recurrence?: 'einmalig' | 'monatlich' | 'vierteljährlich' | 'jährlich'
  startMonth?: string | null // YYYY-MM format
  endDate?: string | null
  categoryId?: string | null
  dayOfMonth?: number | null // 1-31
}

// Apply preset input type
export interface ApplyPresetInput {
  planId: string
  dueDate?: string // Optional override for transaction due date
}

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get paginated presets with optional filtering and sorting
 */
export async function getPresets(
  userId: string,
  options: PresetQueryOptions = {},
): Promise<PaginatedPresets> {
  const {
    search,
    type,
    categoryId,
    recurrence,
    includeExpired = true,
    sortBy = 'createdAt',
    sortDir = 'desc',
    page = 1,
    limit = 20,
  } = options

  // Build where conditions
  const conditions = [eq(transactionPreset.userId, userId)]

  if (search) {
    conditions.push(like(transactionPreset.name, `%${search}%`))
  }

  if (type) {
    conditions.push(eq(transactionPreset.type, type))
  }

  if (categoryId) {
    conditions.push(eq(transactionPreset.categoryId, categoryId))
  }

  if (recurrence) {
    conditions.push(eq(transactionPreset.recurrence, recurrence))
  }

  if (!includeExpired) {
    // Filter out expired presets: endDate is null OR endDate >= today
    const today = getLocalDateString()
    conditions.push(
      sql`(${transactionPreset.endDate} IS NULL OR ${transactionPreset.endDate} >= ${today})`,
    )
  }

  // Build base query
  let baseQuery = db
    .select({
      ...getTableColumns(transactionPreset),
      categoryName: category.name,
      categoryColor: category.color,
    })
    .from(transactionPreset)
    .leftJoin(category, eq(transactionPreset.categoryId, category.id))
    .where(and(...conditions))
    .$dynamic()

  // Apply sorting
  const sortColumn =
    sortBy === 'name'
      ? transactionPreset.name
      : sortBy === 'lastUsedAt'
        ? transactionPreset.lastUsedAt
        : sortBy === 'amount'
          ? transactionPreset.amount
          : transactionPreset.createdAt

  baseQuery =
    sortDir === 'asc'
      ? baseQuery.orderBy(asc(sortColumn))
      : baseQuery.orderBy(desc(sortColumn))

  // Get total count
  const countQuery = db
    .select({ count: count() })
    .from(transactionPreset)
    .where(and(...conditions))

  const [{ count: total }] = await countQuery
  const totalPages = limit === -1 ? 1 : Math.ceil(total / limit)

  // Apply pagination
  if (limit !== -1) {
    const offset = (page - 1) * limit
    baseQuery = baseQuery.limit(limit).offset(offset)
  }

  const presets = await baseQuery

  return {
    presets,
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  }
}

/**
 * Get a single preset by ID
 */
export async function getPresetById(
  id: string,
): Promise<PresetWithTags | undefined> {
  const results = await db
    .select({
      ...getTableColumns(transactionPreset),
      categoryName: category.name,
      categoryColor: category.color,
    })
    .from(transactionPreset)
    .leftJoin(category, eq(transactionPreset.categoryId, category.id))
    .where(eq(transactionPreset.id, id))
    .limit(1)

  if (results.length === 0) return undefined

  return results[0]
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Create a new preset
 */
export async function createPreset(
  userId: string,
  input: CreatePresetInput,
): Promise<TransactionPreset> {
  const now = new Date()

  const [preset] = await db
    .insert(transactionPreset)
    .values({
      name: input.name,
      note: input.note || null,
      type: input.type || 'expense',
      amount: input.amount,
      recurrence: input.recurrence || 'einmalig',
      startMonth: input.startMonth || getCurrentMonth(),
      endDate: input.endDate || null,
      categoryId: input.categoryId || null,
      dayOfMonth: input.dayOfMonth ?? null,
      userId,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  return preset
}

/**
 * Update an existing preset
 */
export async function updatePreset(
  id: string,
  input: UpdatePresetInput,
): Promise<TransactionPreset | undefined> {
  const updateData: Partial<NewTransactionPreset> = {}

  if (input.name !== undefined) updateData.name = input.name
  if (input.note !== undefined) updateData.note = input.note
  if (input.type !== undefined) updateData.type = input.type
  if (input.amount !== undefined) updateData.amount = input.amount
  if (input.recurrence !== undefined) updateData.recurrence = input.recurrence
  if (input.startMonth !== undefined) updateData.startMonth = input.startMonth
  if (input.endDate !== undefined) updateData.endDate = input.endDate
  if (input.categoryId !== undefined) updateData.categoryId = input.categoryId
  if (input.dayOfMonth !== undefined) updateData.dayOfMonth = input.dayOfMonth

  updateData.updatedAt = new Date()

  const [updated] = await db
    .update(transactionPreset)
    .set(updateData)
    .where(eq(transactionPreset.id, id))
    .returning()

  return updated
}

/**
 * Delete a preset
 */
export async function deletePreset(id: string): Promise<boolean> {
  const result = await db
    .delete(transactionPreset)
    .where(eq(transactionPreset.id, id))
    .returning()

  return result.length > 0
}

/**
 * Apply preset to a plan (creates a transaction)
 */
export async function applyPresetToPlan(
  presetId: string,
  input: ApplyPresetInput,
): Promise<any> {
  // Fetch the preset
  const preset = await getPresetById(presetId)
  if (!preset) {
    throw new Error('Preset nicht gefunden')
  }

  // Validate plan exists and is not archived
  const plan = await getPlanById(input.planId)
  if (!plan) {
    throw new Error('Plan nicht gefunden')
  }
  if (plan.isArchived) {
    throw new Error('Plan ist archiviert')
  }

  // Determine due date:
  // 1. Explicit override from input
  // 2. Preset's dayOfMonth (clamped to last valid day of the plan's month)
  // 3. Fall back to plan date
  let dueDate: string
  if (input.dueDate) {
    dueDate = input.dueDate
  } else if (preset.dayOfMonth) {
    const [year, month] = plan.date.split('-').map(Number)
    const lastDayOfMonth = new Date(year, month, 0).getDate()
    const day = Math.min(preset.dayOfMonth, lastDayOfMonth)
    dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  } else {
    dueDate = plan.date
  }

  // Create transaction from preset
  const transactionInput: CreateTransactionInput = {
    name: preset.name,
    note: preset.note,
    type: preset.type,
    dueDate,
    amount: preset.amount,
    isDone: false,
    planId: input.planId,
    categoryId: preset.categoryId,
  }

  const transaction = await createTransaction(transactionInput)

  // Update lastUsedAt timestamp
  await db
    .update(transactionPreset)
    .set({ lastUsedAt: new Date() })
    .where(eq(transactionPreset.id, presetId))

  return transaction
}

/**
 * Check if a preset is expired
 */
export function isPresetExpired(preset: TransactionPreset): boolean {
  if (!preset.endDate) return false

  const today = getLocalDateString()
  return preset.endDate < today
}

/**
 * Check if a preset matches a plan month based on recurrence rules
 * @param preset - The preset to check
 * @param planMonth - Plan month in YYYY-MM format
 * @returns true if preset matches the plan month
 */
export function presetMatchesPlanMonth(
  preset: TransactionPreset,
  planMonth: string,
): boolean {
  const startMonth = preset.startMonth
  if (!startMonth) return true // No startMonth = always matches (legacy presets)

  // Check if expired
  if (preset.endDate) {
    const endMonth = preset.endDate.substring(0, 7) // YYYY-MM from YYYY-MM-DD
    if (planMonth > endMonth) return false
  }

  // Check if plan is before start month
  if (planMonth < startMonth) return false

  switch (preset.recurrence) {
    case 'einmalig':
      return planMonth === startMonth

    case 'monatlich':
      return planMonth >= startMonth

    case 'vierteljährlich': {
      // Calculate months between startMonth and planMonth
      const [startYear, startMonthNum] = startMonth.split('-').map(Number)
      const [planYear, planMonthNum] = planMonth.split('-').map(Number)
      const monthsDiff =
        (planYear - startYear) * 12 + (planMonthNum - startMonthNum)
      return monthsDiff >= 0 && monthsDiff % 3 === 0
    }

    case 'jährlich': {
      // Same month of the year, on or after start
      const startMonthNum = parseInt(startMonth.split('-')[1], 10)
      const planMonthNum = parseInt(planMonth.split('-')[1], 10)
      return planMonthNum === startMonthNum && planMonth >= startMonth
    }

    default:
      return false
  }
}

/**
 * Get all presets with match status for a specific plan month
 */
export async function getPresetsWithMatchStatus(
  userId: string,
  planMonth: string,
): Promise<(PresetWithTags & { isMatching: boolean })[]> {
  const { presets } = await getPresets(userId, {
    includeExpired: false,
    limit: -1,
    sortBy: 'name',
    sortDir: 'asc',
  })

  return presets.map((preset) => ({
    ...preset,
    isMatching: presetMatchesPlanMonth(preset, planMonth),
  }))
}

/**
 * Apply multiple presets to a plan at once
 * @returns Array of created transactions and count
 */
export async function applyMultiplePresetsToPlan(
  presetIds: string[],
  input: ApplyPresetInput,
): Promise<{ transactions: unknown[]; count: number }> {
  const transactions: unknown[] = []

  for (const presetId of presetIds) {
    try {
      const transaction = await applyPresetToPlan(presetId, input)
      transactions.push(transaction)
    } catch (error) {
      // Log error but continue with other presets
      console.error(`Failed to apply preset ${presetId}:`, error)
    }
  }

  return {
    transactions,
    count: transactions.length,
  }
}
