import { db } from '@/db/database'
import { transactionPreset, category } from '@/db/schema/plans'
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  like,
  sql,
  type SQL,
} from 'drizzle-orm'
import { createTransaction, type CreateTransactionInput } from './transactions'
import { getPlanById } from './plans'
import { buildSetValues } from '@/lib/db/partial-update'
import { orDefault, orNull } from '@/lib/defaults'
import { presetMatchesPlanMonth } from './preset-matching'

// Infer types from Drizzle schema
export type TransactionPreset = typeof transactionPreset.$inferSelect
type NewTransactionPreset = typeof transactionPreset.$inferInsert

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
  recurrence?:
    | 'einmalig'
    | 'monatlich'
    | 'vierteljährlich'
    | 'halbjährlich'
    | 'jährlich'
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
  recurrence?:
    | 'einmalig'
    | 'monatlich'
    | 'vierteljährlich'
    | 'halbjährlich'
    | 'jährlich'
  startMonth?: string | null // YYYY-MM format
  endDate?: string | null
  categoryId?: string | null
  dayOfMonth?: number | null // 1-31
  isBudget?: boolean
}

// Update input type
export interface UpdatePresetInput {
  name?: string
  note?: string | null
  type?: 'income' | 'expense'
  amount?: number
  recurrence?:
    | 'einmalig'
    | 'monatlich'
    | 'vierteljährlich'
    | 'halbjährlich'
    | 'jährlich'
  startMonth?: string | null // YYYY-MM format
  endDate?: string | null
  categoryId?: string | null
  dayOfMonth?: number | null // 1-31
  isBudget?: boolean
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

function expiryCondition() {
  const today = getLocalDateString()
  return sql`(${transactionPreset.endDate} IS NULL OR ${transactionPreset.endDate} >= ${today})`
}

function buildPresetConditions(userId: string, options: PresetQueryOptions) {
  const {
    search,
    type,
    categoryId,
    recurrence,
    includeExpired = true,
  } = options
  const cond = <T>(v: T | undefined | null, build: (val: T) => SQL) =>
    v ? build(v) : null
  const candidates = [
    eq(transactionPreset.userId, userId),
    cond(search, (v) => like(transactionPreset.name, `%${v}%`)),
    cond(type, (v) => eq(transactionPreset.type, v)),
    cond(categoryId, (v) => eq(transactionPreset.categoryId, v)),
    cond(recurrence, (v) => eq(transactionPreset.recurrence, v)),
    includeExpired ? null : expiryCondition(),
  ]
  return candidates.filter((c): c is SQL => c !== null)
}

const presetSortColumns = {
  name: transactionPreset.name,
  lastUsedAt: transactionPreset.lastUsedAt,
  amount: transactionPreset.amount,
  createdAt: transactionPreset.createdAt,
} as const

function applyPresetSort<T extends { orderBy: (...args: never[]) => T }>(
  query: T,
  sortBy: PresetQueryOptions['sortBy'],
  sortDir: PresetQueryOptions['sortDir'],
): T {
  const sortColumn = presetSortColumns[sortBy ?? 'createdAt']
  const orderBy = sortDir === 'asc' ? asc(sortColumn) : desc(sortColumn)
  return (query.orderBy as (arg: typeof orderBy) => T)(orderBy)
}

/**
 * Get paginated presets with optional filtering and sorting
 */
export async function getPresets(
  userId: string,
  options: PresetQueryOptions = {},
): Promise<PaginatedPresets> {
  const {
    sortBy = 'createdAt',
    sortDir = 'desc',
    page = 1,
    limit = 20,
  } = options

  const conditions = buildPresetConditions(userId, options)

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

  baseQuery = applyPresetSort(baseQuery, sortBy, sortDir)

  const countQuery = db
    .select({ count: count() })
    .from(transactionPreset)
    .where(and(...conditions))

  const [{ count: total }] = await countQuery
  const totalPages = limit === -1 ? 1 : Math.ceil(total / limit)

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

/**
 * Get multiple presets by IDs (basic columns; used for batch ownership checks).
 */
export async function getPresetsByIds(
  ids: string[],
): Promise<{ id: string; userId: string }[]> {
  if (ids.length === 0) return []
  return db
    .select({
      id: transactionPreset.id,
      userId: transactionPreset.userId,
    })
    .from(transactionPreset)
    .where(inArray(transactionPreset.id, ids))
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function buildPresetInsertValues(
  userId: string,
  input: CreatePresetInput,
  now: Date,
): NewTransactionPreset {
  return {
    name: input.name,
    note: orNull(input.note),
    type: orDefault(input.type, 'expense'),
    amount: input.amount,
    recurrence: orDefault(input.recurrence, 'einmalig'),
    startMonth: orDefault(input.startMonth, getCurrentMonth()),
    endDate: orNull(input.endDate),
    categoryId: orNull(input.categoryId),
    dayOfMonth: orNull(input.dayOfMonth),
    isBudget: orDefault(input.isBudget, false),
    userId,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Create a new preset
 */
export async function createPreset(
  userId: string,
  input: CreatePresetInput,
): Promise<TransactionPreset> {
  const [preset] = await db
    .insert(transactionPreset)
    .values(buildPresetInsertValues(userId, input, new Date()))
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
  // fallow-ignore-next-line code-duplication
  const setValues = buildSetValues<typeof input, NewTransactionPreset>(input, {
    name: (v, s) => {
      s.name = v
    },
    note: (v, s) => {
      s.note = v
    },
    type: (v, s) => {
      s.type = v
    },
    amount: (v, s) => {
      s.amount = v
    },
    recurrence: (v, s) => {
      s.recurrence = v
    },
    startMonth: (v, s) => {
      s.startMonth = v
    },
    endDate: (v, s) => {
      s.endDate = v
    },
    categoryId: (v, s) => {
      s.categoryId = v
    },
    dayOfMonth: (v, s) => {
      s.dayOfMonth = v
    },
    isBudget: (v, s) => {
      s.isBudget = v
    },
  })

  const [updated] = await db
    .update(transactionPreset)
    .set(setValues)
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

function resolvePresetDueDate(
  planDate: string,
  presetDayOfMonth: number | null,
  override?: string,
): string {
  if (override) return override
  if (!presetDayOfMonth) return planDate
  const [year, month] = planDate.split('-').map(Number)
  const lastDayOfMonth = new Date(year, month, 0).getDate()
  const day = Math.min(presetDayOfMonth, lastDayOfMonth)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

async function loadPresetAndPlan(presetId: string, planId: string) {
  const preset = await getPresetById(presetId)
  if (!preset) throw new Error('Preset nicht gefunden')
  const plan = await getPlanById(planId)
  if (!plan) throw new Error('Plan nicht gefunden')
  if (plan.isArchived) throw new Error('Plan ist archiviert')
  return { preset, plan }
}

/**
 * Apply preset to a plan (creates a transaction)
 */
export async function applyPresetToPlan(
  presetId: string,
  input: ApplyPresetInput,
): Promise<any> {
  const { preset, plan } = await loadPresetAndPlan(presetId, input.planId)

  const transactionInput: CreateTransactionInput = {
    name: preset.name,
    note: preset.note,
    type: preset.type,
    dueDate: resolvePresetDueDate(plan.date, preset.dayOfMonth, input.dueDate),
    amount: preset.amount,
    isDone: false,
    isBudget: preset.isBudget,
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
