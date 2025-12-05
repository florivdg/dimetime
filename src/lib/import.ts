import { z } from 'zod'

// ============================================================================
// Raw JSON Types (as imported from files)
// ============================================================================

export const importedPlanRawSchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().nullable(),
  created_at: z.string(),
  is_archived: z.boolean(),
})

export const importedTransactionRawSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.string(),
  created_at: z.string(),
  plan_id: z.string().uuid(),
  is_budget: z.boolean(), // Ignored in transformation
  user_id: z.string().uuid(),
  is_done: z.boolean(),
})

export type ImportedPlanRaw = z.infer<typeof importedPlanRawSchema>
export type ImportedTransactionRaw = z.infer<
  typeof importedTransactionRawSchema
>

// ============================================================================
// Transformed Types (ready for DB insert)
// ============================================================================

export interface TransformedPlan {
  id: string
  name: string | null
  date: string
  notes: string | null
  isArchived: boolean
  createdAt: number // timestamp_ms
  updatedAt: number // timestamp_ms
}

export interface TransformedTransaction {
  id: string
  name: string
  note: string | null
  type: 'income' | 'expense'
  dueDate: string
  amount: number // Cents (always positive)
  isDone: boolean
  completedAt: number | null // timestamp_ms
  planId: string
  userId: string // Mapped user ID
  categoryId: string | null
  createdAt: number // timestamp_ms
  updatedAt: number // timestamp_ms
}

// ============================================================================
// Import Summary
// ============================================================================

export interface ImportSummary {
  plansCount: number
  transactionsCount: number
  uniqueImportedUserIds: string[]
  dateRange: { from: string; to: string } | null
}

// ============================================================================
// User Mapping Type
// ============================================================================

export type UserMapping = Record<string, string> // importedUserId → systemUserId

// ============================================================================
// Import Result
// ============================================================================

export interface ImportResult {
  plansImported: number
  plansSkipped: number
  transactionsImported: number
  transactionsSkipped: number
}

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse and validate plans JSON content
 */
export function parsePlansJson(jsonContent: string): ImportedPlanRaw[] {
  const parsed = JSON.parse(jsonContent) as unknown
  const result = z.array(importedPlanRawSchema).safeParse(parsed)

  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ')
    throw new Error(`Ungültiges Plans-Format: ${errors}`)
  }

  return result.data
}

/**
 * Parse and validate transactions JSON content
 */
export function parseTransactionsJson(
  jsonContent: string,
): ImportedTransactionRaw[] {
  const parsed = JSON.parse(jsonContent) as unknown
  const result = z.array(importedTransactionRawSchema).safeParse(parsed)

  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ')
    throw new Error(`Ungültiges Transaktionen-Format: ${errors}`)
  }

  return result.data
}

// ============================================================================
// Summary Function
// ============================================================================

/**
 * Generate import summary from parsed data
 */
export function getImportSummary(
  plans: ImportedPlanRaw[],
  transactions: ImportedTransactionRaw[],
): ImportSummary {
  // Extract unique user IDs from transactions
  const userIds = new Set<string>()
  transactions.forEach((t) => userIds.add(t.user_id))

  // Calculate date range from plans
  let dateRange: { from: string; to: string } | null = null
  if (plans.length > 0) {
    const dates = plans.map((p) => p.date).sort()
    dateRange = {
      from: dates[0],
      to: dates[dates.length - 1],
    }
  }

  return {
    plansCount: plans.length,
    transactionsCount: transactions.length,
    uniqueImportedUserIds: Array.from(userIds),
    dateRange,
  }
}

// ============================================================================
// Transformation Functions
// ============================================================================

/**
 * Parse PostgreSQL timestamp to milliseconds
 * Input: "2025-11-22 09:46:29.481184+00"
 * Output: timestamp in milliseconds
 */
function parsePostgresTimestamp(timestamp: string): number {
  // Replace space with 'T' for ISO 8601 compatibility
  let isoString = timestamp.replace(' ', 'T')
  // Ensure timezone offset has colon (e.g., +00 → +00:00)
  isoString = isoString.replace(/([+-])(\d{2})$/, '$1$2:00')
  return new Date(isoString).getTime()
}

/**
 * Transform raw plan to DB-ready format
 */
export function transformPlan(raw: ImportedPlanRaw): TransformedPlan {
  const createdAt = parsePostgresTimestamp(raw.created_at)

  return {
    id: raw.id,
    name: null, // Could extract first line from notes if desired
    date: raw.date,
    notes: raw.notes,
    isArchived: raw.is_archived,
    createdAt,
    updatedAt: createdAt, // Same as createdAt for imports
  }
}

/**
 * Transform raw transaction to DB-ready format
 */
export function transformTransaction(
  raw: ImportedTransactionRaw,
  userMapping: UserMapping,
): TransformedTransaction {
  const createdAt = parsePostgresTimestamp(raw.created_at)
  const amountValue = parseFloat(raw.amount)

  // Determine type from sign (negative = expense, positive/zero = income)
  const type: 'income' | 'expense' = amountValue < 0 ? 'expense' : 'income'

  // Convert to cents (absolute value, rounded)
  const amountCents = Math.abs(Math.round(amountValue * 100))

  // Map user ID
  const mappedUserId = userMapping[raw.user_id]
  if (!mappedUserId) {
    throw new Error(
      `Keine Benutzer-Zuordnung für User-ID: ${raw.user_id.substring(0, 8)}...`,
    )
  }

  return {
    id: raw.id,
    name: raw.name,
    note: null,
    type,
    dueDate: raw.due_date,
    amount: amountCents,
    isDone: raw.is_done,
    completedAt: raw.is_done ? createdAt : null, // Use createdAt as completedAt if done
    planId: raw.plan_id,
    userId: mappedUserId,
    categoryId: null, // No category assignment during import
    createdAt,
    updatedAt: createdAt,
  }
}

/**
 * Transform all plans
 */
export function transformPlans(plans: ImportedPlanRaw[]): TransformedPlan[] {
  return plans.map(transformPlan)
}

/**
 * Transform all transactions with user mapping
 */
export function transformTransactions(
  transactions: ImportedTransactionRaw[],
  userMapping: UserMapping,
): TransformedTransaction[] {
  return transactions.map((t) => transformTransaction(t, userMapping))
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate that all plan_ids in transactions exist in plans
 */
export function validatePlanReferences(
  plans: ImportedPlanRaw[],
  transactions: ImportedTransactionRaw[],
): { valid: boolean; missingPlanIds: string[] } {
  const planIds = new Set(plans.map((p) => p.id))
  const missingPlanIds: string[] = []

  transactions.forEach((t) => {
    if (!planIds.has(t.plan_id)) {
      if (!missingPlanIds.includes(t.plan_id)) {
        missingPlanIds.push(t.plan_id)
      }
    }
  })

  return {
    valid: missingPlanIds.length === 0,
    missingPlanIds,
  }
}

/**
 * Validate that all user_ids are mapped
 */
export function validateUserMapping(
  transactions: ImportedTransactionRaw[],
  userMapping: UserMapping,
): { valid: boolean; unmappedUserIds: string[] } {
  const uniqueUserIds = new Set(transactions.map((t) => t.user_id))
  const unmappedUserIds: string[] = []

  uniqueUserIds.forEach((userId) => {
    if (!userMapping[userId]) {
      unmappedUserIds.push(userId)
    }
  })

  return {
    valid: unmappedUserIds.length === 0,
    unmappedUserIds,
  }
}
