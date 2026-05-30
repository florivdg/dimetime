import * as authSchema from '@/db/schema/auth'
import * as plansSchema from '@/db/schema/plans'
import type { TestDatabase } from './test-setup'

/** Fixed timestamp used by every seeder so tests are deterministic. */
export const SEED_NOW = new Date('2026-03-09T00:00:00.000Z')

type UserInsert = typeof authSchema.user.$inferInsert
type CategoryInsert = typeof plansSchema.category.$inferInsert
type PlanInsert = typeof plansSchema.plan.$inferInsert
type ImportSourceInsert = typeof plansSchema.importSource.$inferInsert
type BankTransactionInsert = typeof plansSchema.bankTransaction.$inferInsert
type PlannedTransactionInsert =
  typeof plansSchema.plannedTransaction.$inferInsert
type TransactionPresetInsert = typeof plansSchema.transactionPreset.$inferInsert
type BankTransactionSplitInsert =
  typeof plansSchema.bankTransactionSplit.$inferInsert

export async function seedUser(
  db: TestDatabase,
  overrides: Partial<UserInsert> = {},
): Promise<string> {
  const id = overrides.id ?? 'u1'
  await db.insert(authSchema.user).values({
    id,
    name: 'A',
    email: 'a@example.com',
    createdAt: SEED_NOW,
    updatedAt: SEED_NOW,
    ...overrides,
  })
  return id
}

export async function seedCategory(
  db: TestDatabase,
  overrides: Partial<CategoryInsert> = {},
): Promise<string> {
  const id = overrides.id ?? 'c1'
  await db.insert(plansSchema.category).values({
    id,
    name: 'Cat',
    slug: id,
    createdAt: SEED_NOW,
    updatedAt: SEED_NOW,
    ...overrides,
  })
  return id
}

export async function seedPlan(
  db: TestDatabase,
  overrides: Partial<PlanInsert> = {},
): Promise<string> {
  const id = overrides.id ?? 'p1'
  await db.insert(plansSchema.plan).values({
    id,
    name: 'X',
    date: '2026-03-01',
    isArchived: false,
    createdAt: SEED_NOW,
    updatedAt: SEED_NOW,
    ...overrides,
  })
  return id
}

export async function seedImportSource(
  db: TestDatabase,
  overrides: Partial<ImportSourceInsert> = {},
): Promise<string> {
  const id = overrides.id ?? 's1'
  await db.insert(plansSchema.importSource).values({
    id,
    name: 'S',
    preset: 'ing_csv_v1',
    sourceKind: 'bank_account',
    defaultPlanAssignment: 'none',
    isActive: true,
    createdAt: SEED_NOW,
    updatedAt: SEED_NOW,
    ...overrides,
  })
  return id
}

export async function seedBankTransaction(
  db: TestDatabase,
  overrides: Partial<BankTransactionInsert> = {},
): Promise<string> {
  const id = overrides.id ?? 'bt1'
  await db.insert(plansSchema.bankTransaction).values({
    id,
    sourceId: overrides.sourceId ?? 's1',
    dedupeKey: 'k1',
    bookingDate: '2026-03-01',
    amountCents: -1000,
    currency: 'EUR',
    status: 'booked',
    rawDataJson: '{}',
    isArchived: false,
    isSplit: false,
    importSeenCount: 1,
    planAssignment: 'none',
    createdAt: SEED_NOW,
    updatedAt: SEED_NOW,
    ...overrides,
  })
  return id
}

export async function seedPlannedTransaction(
  db: TestDatabase,
  overrides: Partial<PlannedTransactionInsert> = {},
): Promise<string> {
  const id = overrides.id ?? 'pt1'
  await db.insert(plansSchema.plannedTransaction).values({
    id,
    name: 'T',
    type: 'expense',
    amount: 1000,
    dueDate: '2026-03-01',
    isDone: false,
    isBudget: false,
    createdAt: SEED_NOW,
    updatedAt: SEED_NOW,
    ...overrides,
  })
  return id
}

export async function seedTransactionPreset(
  db: TestDatabase,
  overrides: Partial<TransactionPresetInsert> = {},
): Promise<string> {
  const id = overrides.id ?? 'tp1'
  await db.insert(plansSchema.transactionPreset).values({
    id,
    name: 'Preset',
    type: 'expense',
    amount: 1000,
    recurrence: 'monatlich',
    userId: overrides.userId ?? 'u1',
    createdAt: SEED_NOW,
    updatedAt: SEED_NOW,
    ...overrides,
  })
  return id
}

export async function seedBankTransactionSplit(
  db: TestDatabase,
  overrides: Partial<BankTransactionSplitInsert> = {},
): Promise<string> {
  const id = overrides.id ?? 'sp1'
  await db.insert(plansSchema.bankTransactionSplit).values({
    id,
    bankTransactionId: overrides.bankTransactionId ?? 'bt1',
    amountCents: -500,
    sortOrder: 0,
    isArchived: false,
    createdAt: SEED_NOW,
    updatedAt: SEED_NOW,
    ...overrides,
  })
  return id
}

/** Shared source/bank-transaction ids for the bulk-assign route suites. */
export const BULK_ASSIGN_IDS = {
  sourceId: '33333333-3333-4333-8333-333333333333',
  btId: '44444444-4444-4444-8444-444444444444',
} as const

/**
 * Seed an import source plus a single bank transaction that references it — the
 * shared fixture base for the bank-transaction bulk-assign route suites. The
 * ids default to {@link BULK_ASSIGN_IDS}. Extra fields on the bank transaction
 * (e.g. `planId`, `planAssignment`) can be passed via `txOverrides`.
 */
export async function seedSourceWithBankTransaction(
  db: TestDatabase,
  opts: {
    sourceId?: string
    btId?: string
    txOverrides?: Partial<BankTransactionInsert>
  } = {},
): Promise<{ sourceId: string; btId: string }> {
  const {
    sourceId = BULK_ASSIGN_IDS.sourceId,
    btId = BULK_ASSIGN_IDS.btId,
    txOverrides = {},
  } = opts
  await seedImportSource(db, { id: sourceId })
  await seedBankTransaction(db, {
    id: btId,
    sourceId,
    amountCents: -1000,
    ...txOverrides,
  })
  return { sourceId, btId }
}

/** Build a multipart POST request for the bank-import endpoints. */
export function buildImportFormData(
  endpoint: string,
  fields: Record<string, string | Blob>,
): Request {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  return new Request(`http://test.local${endpoint}`, {
    method: 'POST',
    body: form,
  })
}
