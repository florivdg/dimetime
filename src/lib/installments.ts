import { db } from '@/db/database'
import {
  category,
  installmentPlan,
  installmentSkip,
  plan,
  plannedTransaction,
} from '@/db/schema/plans'
import {
  and,
  asc,
  count,
  eq,
  getTableColumns,
  gte,
  inArray,
  isNull,
  lt,
  lte,
} from 'drizzle-orm'
import { buildSetValues } from '@/lib/db/partial-update'
import { monthOfPlanDate, nextMonth, resolveDueDate } from '@/lib/dates'
import { orDefault, orNull } from '@/lib/defaults'

// Infer types from Drizzle schema
export type InstallmentPlan = typeof installmentPlan.$inferSelect
type NewInstallmentPlan = typeof installmentPlan.$inferInsert
type NewPlannedTransaction = typeof plannedTransaction.$inferInsert

/** Safety net for the month walk in {@link projectMonths} (100 years). */
const MAX_PROJECTION_MONTHS = 1200

// Create input type
export interface CreateInstallmentPlanInput {
  name: string
  note?: string | null
  amount: number // Monthly rate in cents
  finalAmount?: number | null // Differing last rate in cents
  totalInstallments: number
  prepaidInstallments?: number
  startMonth: string // YYYY-MM format
  dayOfMonth?: number | null // 1-31
  categoryId?: string | null
}

// Update input type
export type UpdateInstallmentPlanInput = Partial<CreateInstallmentPlanInput>

export interface InstallmentPlanStats {
  /** Installments paid before tracking started plus checked linked rows. */
  paidCount: number
  /** Linked rows that are materialized but not checked yet. */
  openLinkedCount: number
  remainingCount: number
  /**
   * What the rates still to be paid add up to, in cents: `remainingCount`
   * regular rates, the last of them charged as the differing final rate as
   * long as that one is still open.
   */
  remainingSum: number
  /** Dynamic projection relative to the `today` month passed in. */
  projectedEndMonth: string | null
}

export type InstallmentPlanWithStats = InstallmentPlan &
  InstallmentPlanStats & {
    categoryName: string | null
    categoryColor: string | null
  }

export interface InstallmentTimelineEntry {
  installmentId: string
  name: string
  amount: number
}

export interface InstallmentTimelineMonth {
  month: string // YYYY-MM format
  entries: InstallmentTimelineEntry[]
  total: number
}

export interface InstallmentAggregates {
  /** Sum of the rates due in the `today` month. */
  currentMonthlyLoad: number
  totalRemainingSum: number
}

/** The running installments and their aggregates, without the timeline. */
export interface InstallmentSummary {
  running: InstallmentPlanWithStats[]
  aggregates: InstallmentAggregates
}

export interface InstallmentOverview {
  installments: InstallmentPlanWithStats[]
  aggregates: InstallmentAggregates
  timeline: InstallmentTimelineMonth[]
}

/** Badge data for a materialized row ("Rate 3 von 12"). */
export interface InstallmentBadge {
  installmentId: string
  installmentName: string
  ratePosition: number
  rateTotal: number
}

/** The oldest non-archived plan of a month — the only one that gets rows. */
interface PlanSlot {
  id: string
  date: string // YYYY-MM-DD format
  month: string // YYYY-MM format
}

interface LinkedCounts {
  doneCount: number
  openCount: number
}

/**
 * An open (unchecked) linked row that lives in a non-archived plan — the only
 * kind of row the reconciliation is allowed to touch.
 */
interface OpenLinkedRow {
  id: string
  /** Chronological rank among *all* linked rows, 1-based. */
  rank: number
  name: string
  amount: number
  dueDate: string // YYYY-MM-DD format
  categoryId: string | null
  planDate: string | null // YYYY-MM-DD format
  month: string // YYYY-MM format
}

const EMPTY_COUNTS: LinkedCounts = { doneCount: 0, openCount: 0 }
const EMPTY_MONTHS: ReadonlySet<string> = new Set<string>()
const EMPTY_RANKS: ReadonlyMap<string, number> = new Map<string, number>()

/**
 * The order every rank is derived from. The rate a row owes and the "Rate x von
 * n" the badge shows both hang off it, so all three loaders share it.
 */
const LINKED_ROW_ORDER = [
  asc(plannedTransaction.dueDate),
  asc(plannedTransaction.id),
]

/**
 * Number each installment's rows chronologically, 1-based over *every* linked
 * row — checked and archived ones included, because they occupy a position all
 * the same. Rows have to arrive in {@link LINKED_ROW_ORDER}; unlinked ones are
 * dropped.
 */
function rankLinkedRows<T extends { installmentId: string | null }>(
  rows: T[],
): { row: T; installmentId: string; rank: number }[] {
  const ranks = new Map<string, number>()
  const ranked: { row: T; installmentId: string; rank: number }[] = []

  for (const row of rows) {
    if (!row.installmentId) continue
    const rank = (ranks.get(row.installmentId) ?? 0) + 1
    ranks.set(row.installmentId, rank)
    ranked.push({ row, installmentId: row.installmentId, rank })
  }

  return ranked
}

function groupToSets<T>(
  rows: T[],
  keyOf: (row: T) => string | null,
  valueOf: (row: T) => string,
): Map<string, Set<string>> {
  const grouped = new Map<string, Set<string>>()
  for (const row of rows) {
    const key = keyOf(row)
    if (!key) continue
    const values = grouped.get(key) ?? new Set<string>()
    values.add(valueOf(row))
    grouped.set(key, values)
  }
  return grouped
}

/**
 * Count linked planned transactions per installment, split by checkmark state.
 */
async function loadLinkedCounts(
  installmentIds: string[],
): Promise<Map<string, LinkedCounts>> {
  const counts = new Map<string, LinkedCounts>()
  if (installmentIds.length === 0) return counts

  const rows = await db
    .select({
      installmentId: plannedTransaction.installmentId,
      isDone: plannedTransaction.isDone,
      total: count(),
    })
    .from(plannedTransaction)
    .where(inArray(plannedTransaction.installmentId, installmentIds))
    .groupBy(plannedTransaction.installmentId, plannedTransaction.isDone)

  for (const row of rows) {
    if (!row.installmentId) continue
    const entry = counts.get(row.installmentId) ?? {
      doneCount: 0,
      openCount: 0,
    }
    if (row.isDone) entry.doneCount += row.total
    else entry.openCount += row.total
    counts.set(row.installmentId, entry)
  }

  return counts
}

/**
 * Tombstoned months (`YYYY-MM`) per installment.
 */
async function loadSkipMonths(
  installmentIds: string[],
): Promise<Map<string, Set<string>>> {
  if (installmentIds.length === 0) return new Map()

  const rows = await db
    .select({
      installmentId: installmentSkip.installmentId,
      month: installmentSkip.month,
    })
    .from(installmentSkip)
    .where(inArray(installmentSkip.installmentId, installmentIds))

  return groupToSets(
    rows,
    (row) => row.installmentId,
    (row) => row.month,
  )
}

/**
 * Months (`YYYY-MM`) that already carry a checked linked row, per installment,
 * each mapped to the chronological rank of that row. The month comes from the
 * row's plan (its due date is only a fallback for rows without a plan).
 *
 * Every linked row is loaded so the rank matches the one the badge derives
 * ({@link loadInstallmentBadges}); the open ones are only dropped afterwards,
 * keeping the rank of the checked rows intact. That rank is what turns a
 * checked month into a position — and a position into a rate amount
 * ({@link rateAmountAt}).
 */
async function loadDoneMonths(
  installmentIds: string[],
): Promise<Map<string, Map<string, number>>> {
  if (installmentIds.length === 0) return new Map()

  const rows = await db
    .select({
      installmentId: plannedTransaction.installmentId,
      isDone: plannedTransaction.isDone,
      dueDate: plannedTransaction.dueDate,
      planDate: plan.date,
    })
    .from(plannedTransaction)
    .leftJoin(plan, eq(plannedTransaction.planId, plan.id))
    .where(inArray(plannedTransaction.installmentId, installmentIds))
    .orderBy(...LINKED_ROW_ORDER)

  const done = new Map<string, Map<string, number>>()

  for (const { row, installmentId, rank } of rankLinkedRows(rows)) {
    if (!row.isDone) continue
    const months = done.get(installmentId) ?? new Map<string, number>()
    months.set(monthOfPlanDate(row.planDate ?? row.dueDate), rank)
    done.set(installmentId, months)
  }

  return done
}

/**
 * Open linked rows per installment that sit in a non-archived plan. Rows in
 * archived plans are immutable history and never show up here.
 *
 * Every linked row is loaded so the chronological rank matches the one the
 * badge derives ({@link loadInstallmentBadges}); checked and archived rows are
 * only dropped afterwards, keeping the rank of the survivors intact.
 */
async function loadOpenLinkedRows(
  installmentIds: string[],
): Promise<Map<string, OpenLinkedRow[]>> {
  const open = new Map<string, OpenLinkedRow[]>()
  if (installmentIds.length === 0) return open

  const rows = await db
    .select({
      id: plannedTransaction.id,
      installmentId: plannedTransaction.installmentId,
      name: plannedTransaction.name,
      amount: plannedTransaction.amount,
      dueDate: plannedTransaction.dueDate,
      categoryId: plannedTransaction.categoryId,
      isDone: plannedTransaction.isDone,
      planDate: plan.date,
      isArchived: plan.isArchived,
    })
    .from(plannedTransaction)
    .leftJoin(plan, eq(plannedTransaction.planId, plan.id))
    .where(inArray(plannedTransaction.installmentId, installmentIds))
    .orderBy(...LINKED_ROW_ORDER)

  for (const { row, installmentId, rank } of rankLinkedRows(rows)) {
    if (row.isDone || row.isArchived) continue
    const rowsOfInstallment = open.get(installmentId) ?? []
    rowsOfInstallment.push({
      id: row.id,
      rank,
      name: row.name,
      amount: row.amount,
      dueDate: row.dueDate,
      categoryId: row.categoryId,
      planDate: row.planDate,
      month: monthOfPlanDate(row.planDate ?? row.dueDate),
    })
    open.set(installmentId, rowsOfInstallment)
  }

  return open
}

/** The open rows of a single installment — see {@link loadOpenLinkedRows}. */
async function loadOpenRowsOf(installmentId: string): Promise<OpenLinkedRow[]> {
  const open = await loadOpenLinkedRows([installmentId])
  return open.get(installmentId) ?? []
}

/**
 * Plan ids that already carry a row per installment.
 */
async function loadMaterializedPlanIds(
  installmentIds: string[],
): Promise<Map<string, Set<string>>> {
  if (installmentIds.length === 0) return new Map()

  const rows = await db
    .select({
      installmentId: plannedTransaction.installmentId,
      planId: plannedTransaction.planId,
    })
    .from(plannedTransaction)
    .where(inArray(plannedTransaction.installmentId, installmentIds))

  return groupToSets(
    rows,
    (row) => row.installmentId,
    (row) => row.planId ?? '',
  )
}

/**
 * Oldest non-archived plan per month (earliest `createdAt`, ties broken by id),
 * ordered chronologically. `range` narrows the scan: `from` keeps every month
 * from that one on, `month` limits it to that single month.
 */
async function loadOldestPlanPerMonth(
  range: { from: string } | { month: string },
): Promise<PlanSlot[]> {
  const conditions = [eq(plan.isArchived, false)]
  if ('from' in range) {
    conditions.push(gte(plan.date, `${range.from}-01`))
  } else {
    conditions.push(gte(plan.date, `${range.month}-01`))
    conditions.push(lt(plan.date, `${nextMonth(range.month)}-01`))
  }

  const rows = await db
    .select({ id: plan.id, date: plan.date })
    .from(plan)
    .where(and(...conditions))
    .orderBy(asc(plan.createdAt), asc(plan.id))

  const slots = new Map<string, PlanSlot>()
  for (const row of rows) {
    const month = monthOfPlanDate(row.date)
    if (slots.has(month)) continue
    slots.set(month, { id: row.id, date: row.date, month })
  }

  return [...slots.values()].sort((a, b) => a.month.localeCompare(b.month))
}

/**
 * How many rows may still be materialized: never more than the installments
 * that are actually left (rule "Materialisierungs-Budget").
 */
function materializationBudget(
  installment: InstallmentPlan,
  counts: LinkedCounts,
): number {
  return Math.max(
    0,
    installment.totalInstallments -
      installment.prepaidInstallments -
      counts.doneCount -
      counts.openCount,
  )
}

/**
 * The amount of the rate at `position` (1-based and counting the prepaid ones,
 * exactly like the "Rate x von n" badge): the last rate uses the differing
 * final amount whenever one is set. The single source of truth for
 * "which amount does rate n cost?".
 */
export function rateAmountAt(
  installment: Pick<
    InstallmentPlan,
    'amount' | 'finalAmount' | 'totalInstallments'
  >,
  position: number,
): number {
  if (installment.finalAmount === null) return installment.amount
  return position >= installment.totalInstallments
    ? installment.finalAmount
    : installment.amount
}

/**
 * Whether one of the checked rows already sat at the last position — the same
 * position rule {@link rateAmountAt} prices by, so a row checked out of order
 * (a later month paid ahead) settles the final rate for good.
 */
function isFinalRatePaid(
  installment: Pick<
    InstallmentPlan,
    'prepaidInstallments' | 'totalInstallments'
  >,
  doneRanks: ReadonlyMap<string, number>,
): boolean {
  for (const rank of doneRanks.values()) {
    if (installment.prepaidInstallments + rank >= installment.totalInstallments)
      return true
  }
  return false
}

/**
 * The rate the last of the still open ones costs: the differing final rate,
 * unless there is none or it was already checked off — a later month paid
 * ahead settles it, and what stays open then sits before it.
 */
function lastOpenRate(
  installment: Pick<InstallmentPlan, 'amount' | 'finalAmount'>,
  finalRatePaid: boolean,
): number {
  if (finalRatePaid) return installment.amount
  return installment.finalAmount ?? installment.amount
}

/**
 * What the rates still to be paid add up to: `remainingCount` regular rates,
 * the last of them charged as {@link lastOpenRate}.
 */
function remainingSumOf(
  installment: Pick<InstallmentPlan, 'amount' | 'finalAmount'>,
  remainingCount: number,
  finalRatePaid: boolean,
): number {
  if (remainingCount === 0) return 0
  return (
    (remainingCount - 1) * installment.amount +
    lastOpenRate(installment, finalRatePaid)
  )
}

function buildInstallmentRow(
  installment: InstallmentPlan,
  slot: PlanSlot,
  now: Date,
): NewPlannedTransaction {
  return {
    name: installment.name,
    type: 'expense',
    dueDate: resolveDueDate(slot.date, installment.dayOfMonth),
    // Which rate a row owes follows from its rank, which only settles once the
    // row set is final — the reprice pass in {@link materializeInstallments}
    // owns that decision, so a fresh row starts out on the regular rate
    amount: installment.amount,
    isDone: false,
    isBudget: false,
    planId: slot.id,
    userId: installment.userId,
    categoryId: installment.categoryId,
    installmentId: installment.id,
    createdAt: now,
    updatedAt: now,
  }
}

function collectRowsForInstallment(
  installment: InstallmentPlan,
  slots: PlanSlot[],
  context: {
    counts: Map<string, LinkedCounts>
    skips: Map<string, Set<string>>
    materialized: Map<string, Set<string>>
    now: Date
  },
): NewPlannedTransaction[] {
  let budget = materializationBudget(
    installment,
    context.counts.get(installment.id) ?? EMPTY_COUNTS,
  )
  const skipped = context.skips.get(installment.id) ?? EMPTY_MONTHS
  const taken = context.materialized.get(installment.id) ?? EMPTY_MONTHS
  const rows: NewPlannedTransaction[] = []

  for (const slot of slots) {
    if (budget <= 0) break
    if (slot.month < installment.startMonth) continue
    if (skipped.has(slot.month)) continue
    if (taken.has(slot.id)) continue
    rows.push(buildInstallmentRow(installment, slot, context.now))
    budget -= 1
  }

  return rows
}

/**
 * Idempotently materialize installments into the given plan slots
 * (chronologically, oldest month first, until the budget is exhausted).
 * @returns Number of created rows
 */
async function materializeInstallments(
  installments: InstallmentPlan[],
  slots: PlanSlot[],
): Promise<number> {
  if (installments.length === 0 || slots.length === 0) return 0

  const ids = installments.map((installment) => installment.id)
  const [counts, skips, materialized] = await Promise.all([
    loadLinkedCounts(ids),
    loadSkipMonths(ids),
    loadMaterializedPlanIds(ids),
  ])

  const context = { counts, skips, materialized, now: new Date() }
  const rows = installments.flatMap((installment) =>
    collectRowsForInstallment(installment, slots, context),
  )

  const inserted =
    rows.length === 0
      ? []
      : await db
          .insert(plannedTransaction)
          .values(rows)
          .onConflictDoNothing()
          .returning({ id: plannedTransaction.id })

  // The ranks only settle once the row set is final, so every plan with a
  // differing final rate is repriced afterwards — regardless of how many rows
  // were actually inserted, which makes the pass self-healing. Plans without a
  // final rate charge the same amount at every position and are skipped
  const finalRatePlans = installments.filter(
    (installment) => installment.finalAmount !== null,
  )
  const openRows = await loadOpenLinkedRows(
    finalRatePlans.map((installment) => installment.id),
  )
  for (const installment of finalRatePlans) {
    // Repricing an installment against itself: the amount is the only patch
    // that is not a no-op, and it comes from the rank
    await applyRowPatches(
      openRows.get(installment.id) ?? [],
      installment,
      installment,
    )
  }

  return inserted.length
}

/**
 * Months an installment is projected to run in, starting at the later of
 * `today` and its start month. Months with a tombstone are skipped, so missed
 * months push the end further out. Months that already carry a checked row are
 * skipped too — their rate is paid and is not part of the remaining ones.
 */
function projectMonths(
  installment: InstallmentPlan,
  remainingCount: number,
  today: string,
  skipped: ReadonlySet<string>,
  doneMonths: ReadonlyMap<string, number>,
): string[] {
  const months: string[] = []
  let month = today > installment.startMonth ? today : installment.startMonth
  let steps = 0

  while (months.length < remainingCount && steps < MAX_PROJECTION_MONTHS) {
    if (!skipped.has(month) && !doneMonths.has(month)) months.push(month)
    month = nextMonth(month)
    steps += 1
  }

  return months
}

interface InstallmentSnapshot {
  plans: InstallmentPlanWithStats[]
  /** Projected months per installment id, chronologically ordered. */
  projectedMonths: Map<string, string[]>
  /** Months with a checked linked row, and its rank, per installment id. */
  doneMonths: Map<string, Map<string, number>>
  /** Whether the final rate is already settled, per installment id. */
  finalRatePaid: Map<string, boolean>
}

/**
 * Load installments enriched with counters and projection.
 */
async function loadInstallmentSnapshot(
  today: string,
): Promise<InstallmentSnapshot> {
  const rows = await db
    .select({
      ...getTableColumns(installmentPlan),
      categoryName: category.name,
      categoryColor: category.color,
    })
    .from(installmentPlan)
    .leftJoin(category, eq(installmentPlan.categoryId, category.id))
    // NULL sorts first in SQLite, so running installments come before paid-off ones
    .orderBy(
      asc(installmentPlan.completedAt),
      asc(installmentPlan.startMonth),
      asc(installmentPlan.name),
    )

  const ids = rows.map((row) => row.id)
  const [counts, skips, doneMonths] = await Promise.all([
    loadLinkedCounts(ids),
    loadSkipMonths(ids),
    loadDoneMonths(ids),
  ])

  const projectedMonths = new Map<string, string[]>()
  const finalRatePaid = new Map<string, boolean>()
  const plans = rows.map((row) => {
    const linked = counts.get(row.id) ?? EMPTY_COUNTS
    const doneRanks = doneMonths.get(row.id) ?? EMPTY_RANKS
    const settled = isFinalRatePaid(row, doneRanks)
    finalRatePaid.set(row.id, settled)
    const paidCount = row.prepaidInstallments + linked.doneCount
    const remainingCount = Math.max(0, row.totalInstallments - paidCount)
    const months = row.completedAt
      ? []
      : projectMonths(
          row,
          remainingCount,
          today,
          skips.get(row.id) ?? EMPTY_MONTHS,
          doneRanks,
        )
    projectedMonths.set(row.id, months)

    return {
      ...row,
      paidCount,
      openLinkedCount: linked.openCount,
      remainingCount,
      remainingSum: remainingSumOf(row, remainingCount, settled),
      projectedEndMonth: months.at(-1) ?? null,
    }
  })

  return { plans, projectedMonths, doneMonths, finalRatePaid }
}

/**
 * Load the stored installment row as-is — the existence check the API routes
 * guard with. Counters and projection are only ever needed by the overview
 * ({@link getInstallmentOverview}), which loads them for every plan at once.
 */
export async function findInstallmentPlan(
  id: string,
): Promise<InstallmentPlan | undefined> {
  return db.query.installmentPlan.findFirst({
    where: eq(installmentPlan.id, id),
  })
}

/**
 * Create a new installment plan and fill every eligible plan right away
 */
export async function createInstallmentPlan(
  input: CreateInstallmentPlanInput,
  userId: string,
): Promise<InstallmentPlan> {
  const now = new Date()
  const [created] = await db
    .insert(installmentPlan)
    .values({
      name: input.name,
      note: orNull(input.note),
      amount: input.amount,
      finalAmount: orNull(input.finalAmount),
      totalInstallments: input.totalInstallments,
      prepaidInstallments: orDefault(input.prepaidInstallments, 0),
      startMonth: input.startMonth,
      dayOfMonth: orNull(input.dayOfMonth),
      categoryId: orNull(input.categoryId),
      userId,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  await syncPlansForInstallment(created.id)
  return created
}

/**
 * Update an installment plan, reprice its open rows and re-sync the plans
 */
export async function updateInstallmentPlan(
  id: string,
  input: UpdateInstallmentPlanInput,
): Promise<InstallmentPlan | undefined> {
  const existing = await db.query.installmentPlan.findFirst({
    where: eq(installmentPlan.id, id),
  })
  if (!existing) return undefined

  const setValues = buildSetValues<typeof input, NewInstallmentPlan>(input, {
    name: (v, s) => {
      s.name = v
    },
    note: (v, s) => {
      s.note = v
    },
    amount: (v, s) => {
      s.amount = v
    },
    finalAmount: (v, s) => {
      s.finalAmount = v
    },
    totalInstallments: (v, s) => {
      s.totalInstallments = v
    },
    prepaidInstallments: (v, s) => {
      s.prepaidInstallments = v
    },
    startMonth: (v, s) => {
      s.startMonth = v
    },
    dayOfMonth: (v, s) => {
      s.dayOfMonth = v
    },
    categoryId: (v, s) => {
      s.categoryId = v
    },
  })

  const [updated] = await db
    .update(installmentPlan)
    .set(setValues)
    .where(eq(installmentPlan.id, id))
    .returning()
  if (!updated) return undefined

  await reconcileOpenRows(existing, updated)
  await syncPlansForInstallment(id)
  return updated
}

/**
 * Stage `next` for a row field — but only when the installment actually changed
 * it and the row still carries the previous value. Manually edited values are
 * left alone.
 */
function propagateIfUntouched<K extends keyof NewPlannedTransaction>(
  patch: Partial<NewPlannedTransaction>,
  key: K,
  current: NewPlannedTransaction[K],
  previous: NewPlannedTransaction[K],
  next: NewPlannedTransaction[K],
): void {
  if (previous !== next && current === previous) patch[key] = next
}

/**
 * Whether `amount` is one of the rates the plan itself charges — before or
 * after the update. Anything else was typed in by hand.
 */
function isPlanRate(
  amount: number,
  previous: Pick<InstallmentPlan, 'amount' | 'finalAmount'>,
  updated: Pick<InstallmentPlan, 'amount' | 'finalAmount'>,
): boolean {
  return (
    amount === previous.amount ||
    amount === previous.finalAmount ||
    amount === updated.amount ||
    amount === updated.finalAmount
  )
}

/**
 * The edits that still have to reach an untouched open row.
 *
 * The amount is the one field the installment does not simply hand down: which
 * rate a row owes follows from its chronological rank, so it is recomputed
 * instead of compared against a previous installment value. A row is repriced
 * when it still carries one of the rates the plan itself charges
 * ({@link isPlanRate}); anything else is a manual edit and stays untouched.
 *
 * Accepted trade-off: a manual edit that happens to equal one of the plan's own
 * two rates is indistinguishable from a stale rate and gets normalized to the
 * rank-correct one.
 */
function buildRowPatch(
  row: OpenLinkedRow,
  previous: InstallmentPlan,
  updated: InstallmentPlan,
): Partial<NewPlannedTransaction> | null {
  const patch: Partial<NewPlannedTransaction> = {}

  const expected = rateAmountAt(updated, updated.prepaidInstallments + row.rank)
  if (row.amount !== expected && isPlanRate(row.amount, previous, updated)) {
    patch.amount = expected
  }
  propagateIfUntouched(patch, 'name', row.name, previous.name, updated.name)
  propagateIfUntouched(
    patch,
    'categoryId',
    row.categoryId,
    previous.categoryId,
    updated.categoryId,
  )
  // A changed dayOfMonth shows up as a different resolved due date
  if (row.planDate) {
    propagateIfUntouched(
      patch,
      'dueDate',
      row.dueDate,
      resolveDueDate(row.planDate, previous.dayOfMonth),
      resolveDueDate(row.planDate, updated.dayOfMonth),
    )
  }

  return Object.keys(patch).length > 0 ? patch : null
}

/**
 * Write the propagated edits, batched: rows that end up with the exact same
 * patch — the common case, since a rate/name/category change hits every
 * untouched row alike — share a single UPDATE. Recomputed due dates differ per
 * plan month and therefore land in their own groups.
 *
 * The single entry point for the amount decision: pass the same installment as
 * `previous` and `updated` to reprice rows without an update behind them (every
 * other patch is a no-op then).
 */
async function applyRowPatches(
  rows: OpenLinkedRow[],
  previous: InstallmentPlan,
  updated: InstallmentPlan,
): Promise<void> {
  const groups = new Map<
    string,
    { patch: Partial<NewPlannedTransaction>; ids: string[] }
  >()

  for (const row of rows) {
    const patch = buildRowPatch(row, previous, updated)
    if (!patch) continue
    const key = JSON.stringify(patch)
    const group = groups.get(key) ?? { patch, ids: [] }
    group.ids.push(row.id)
    groups.set(key, group)
  }

  const now = new Date()
  for (const group of groups.values()) {
    await db
      .update(plannedTransaction)
      .set({ ...group.patch, updatedAt: now })
      .where(inArray(plannedTransaction.id, group.ids))
  }
}

/**
 * Delete linked rows by id.
 * @returns Number of removed rows
 */
async function deleteRowsById(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0

  const removed = await db
    .delete(plannedTransaction)
    .where(inArray(plannedTransaction.id, ids))
    .returning({ id: plannedTransaction.id })

  return removed.length
}

/**
 * Reconcile the materialized rows with an updated installment: prune rows the
 * update made obsolete (moved start month, lowered total / raised prepaid
 * count), then propagate the edits to the untouched survivors.
 *
 * Pruning renumbers the ranks the rates hang off, so it has to happen before
 * the patches — a dropped row moves the final rate one position up.
 *
 * Only open rows in non-archived plans are ever touched — checked rows are
 * history and archived plans are immutable, so the invariant may stay violated
 * when nothing prunable is left.
 */
async function reconcileOpenRows(
  previous: InstallmentPlan,
  updated: InstallmentPlan,
): Promise<void> {
  const open = await loadOpenRowsOf(updated.id)

  // Rows before a start month that moved into the future
  const tooEarly = open.filter((row) => row.month < updated.startMonth)
  let pruned = await deleteRowsById(tooEarly.map((row) => row.id))

  // Rows beyond the materialization budget, newest plan month first
  const counts =
    (await loadLinkedCounts([updated.id])).get(updated.id) ?? EMPTY_COUNTS
  const surplus =
    updated.prepaidInstallments +
    counts.doneCount +
    counts.openCount -
    updated.totalInstallments
  if (surplus > 0) {
    const newestFirst = open
      .filter((row) => row.month >= updated.startMonth)
      .sort(
        (a, b) =>
          b.month.localeCompare(a.month) ||
          b.dueDate.localeCompare(a.dueDate) ||
          b.id.localeCompare(a.id),
      )
    const ids = newestFirst.slice(0, surplus).map((row) => row.id)
    pruned += await deleteRowsById(ids)
  }

  // Only a deletion can have invalidated the ranks loaded above
  const survivors = pruned > 0 ? await loadOpenRowsOf(updated.id) : open
  await applyRowPatches(survivors, previous, updated)
}

/**
 * Delete the open (unchecked) rows of an installment. Checked rows stay as
 * history — and so do rows inside archived plans, which are immutable.
 * @returns Number of removed rows
 */
async function deleteOpenLinkedRows(installmentId: string): Promise<number> {
  const open = await loadOpenRowsOf(installmentId)
  return deleteRowsById(open.map((row) => row.id))
}

/**
 * Pay off ("ablösen") an installment plan: it stops producing rows and all its
 * open rows are removed from the plans.
 */
export async function completeInstallmentPlan(
  id: string,
): Promise<InstallmentPlan | undefined> {
  const now = new Date()
  const [updated] = await db
    .update(installmentPlan)
    .set({ completedAt: now, updatedAt: now })
    .where(eq(installmentPlan.id, id))
    .returning()

  if (!updated) return undefined

  await deleteOpenLinkedRows(id)
  return updated
}

/**
 * Delete an installment plan. Open rows are removed from the plans first,
 * checked rows survive (their `installmentId` is set to NULL).
 */
export async function deleteInstallmentPlan(id: string): Promise<boolean> {
  await deleteOpenLinkedRows(id)

  const result = await db
    .delete(installmentPlan)
    .where(eq(installmentPlan.id, id))
    .returning({ id: installmentPlan.id })

  return result.length > 0
}

/**
 * Pull every eligible installment into a plan (called right after the plan was
 * created). Archived plans and plans that are not the oldest of their month are
 * ignored.
 * @returns Number of created rows
 */
export async function syncInstallmentsIntoPlan(
  planId: string,
): Promise<number> {
  const target = await db.query.plan.findFirst({ where: eq(plan.id, planId) })
  if (!target || target.isArchived) return 0

  const month = monthOfPlanDate(target.date)
  const [slot] = await loadOldestPlanPerMonth({ month })
  if (!slot || slot.id !== planId) return 0

  const installments = await db.query.installmentPlan.findMany({
    where: and(
      isNull(installmentPlan.completedAt),
      lte(installmentPlan.startMonth, month),
    ),
  })

  return materializeInstallments(installments, [slot])
}

/**
 * Fill all existing eligible plans for one installment, oldest month first.
 * @returns Number of created rows
 */
export async function syncPlansForInstallment(
  installmentId: string,
): Promise<number> {
  const installment = await db.query.installmentPlan.findFirst({
    where: eq(installmentPlan.id, installmentId),
  })
  if (!installment || installment.completedAt) return 0

  const slots = await loadOldestPlanPerMonth({ from: installment.startMonth })
  return materializeInstallments([installment], slots)
}

/**
 * Tombstone a month for an installment so the sync never fills it again.
 * @returns true when a new tombstone was written
 */
export async function recordInstallmentSkip(
  installmentId: string,
  month: string,
): Promise<boolean> {
  const now = new Date()
  const created = await db
    .insert(installmentSkip)
    .values({ installmentId, month, createdAt: now, updatedAt: now })
    .onConflictDoNothing()
    .returning({ id: installmentSkip.id })

  return created.length > 0
}

/**
 * Badge data ("Rate x von n") for planned transactions linked to an
 * installment plan. The position of a row is the number of already prepaid
 * installments plus its chronological rank among all rows of that installment
 * (ordered by due date, ties broken by id).
 * @param transactions - Rows to look up, unlinked ones are ignored
 * @returns Map keyed by transaction id; linked rows only
 */
export async function loadInstallmentBadges(
  transactions: { id: string; installmentId: string | null }[],
): Promise<Map<string, InstallmentBadge>> {
  const badges = new Map<string, InstallmentBadge>()
  const ids = [
    ...new Set(
      transactions.flatMap((transaction) =>
        transaction.installmentId ? [transaction.installmentId] : [],
      ),
    ),
  ]
  if (ids.length === 0) return badges

  const [installments, rows] = await Promise.all([
    db
      .select({
        id: installmentPlan.id,
        name: installmentPlan.name,
        totalInstallments: installmentPlan.totalInstallments,
        prepaidInstallments: installmentPlan.prepaidInstallments,
      })
      .from(installmentPlan)
      .where(inArray(installmentPlan.id, ids)),
    db
      .select({
        id: plannedTransaction.id,
        installmentId: plannedTransaction.installmentId,
      })
      .from(plannedTransaction)
      .where(inArray(plannedTransaction.installmentId, ids))
      .orderBy(...LINKED_ROW_ORDER),
  ])

  const byId = new Map(installments.map((entry) => [entry.id, entry]))
  const ranks = new Map<string, number>()

  for (const row of rows) {
    const installment = row.installmentId
      ? byId.get(row.installmentId)
      : undefined
    if (!installment) continue

    const rank = (ranks.get(installment.id) ?? 0) + 1
    ranks.set(installment.id, rank)
    badges.set(row.id, {
      installmentId: installment.id,
      installmentName: installment.name,
      ratePosition: installment.prepaidInstallments + rank,
      rateTotal: installment.totalInstallments,
    })
  }

  return badges
}

/** A plan still producing rates: not paid off and with installments left. */
function isRunning(installment: InstallmentPlanWithStats): boolean {
  return !installment.completedAt && installment.remainingCount > 0
}

/**
 * The rate falling in the `index`-th projected month of an installment. Which
 * rate that is hangs off the position, not off the length of the projection:
 * the final rate is the last of the `remainingCount` open ones, so a projection
 * cut short by {@link MAX_PROJECTION_MONTHS} never reaches it, and a final rate
 * that is already checked off is never charged a second time.
 */
function projectedRateAmount(
  installment: InstallmentPlanWithStats,
  index: number,
  finalRatePaid: boolean,
): number {
  return index === installment.remainingCount - 1
    ? lastOpenRate(installment, finalRatePaid)
    : installment.amount
}

/**
 * Sum of the rates due in `today`: an installment contributes when its first
 * projected month is the current one (start month reached, no tombstone) — or
 * when this month's rate is already checked off, because the burden existed
 * either way. A checked row is priced by its own rank, which is the one case
 * where the current month can carry the final rate of a plan that is still
 * running: paying the last rate ahead leaves earlier ones open.
 */
function sumCurrentMonthlyLoad(
  installments: InstallmentPlanWithStats[],
  snapshot: InstallmentSnapshot,
  today: string,
): number {
  return installments.reduce((total, installment) => {
    const doneRanks = snapshot.doneMonths.get(installment.id) ?? EMPTY_RANKS
    const months = snapshot.projectedMonths.get(installment.id) ?? []
    // The current month is the plan's last one when nothing follows it
    if (months[0] === today) {
      const settled = snapshot.finalRatePaid.get(installment.id) ?? false
      return total + projectedRateAmount(installment, 0, settled)
    }
    const paidRank = doneRanks.get(today)
    if (paidRank === undefined) return total
    return (
      total +
      rateAmountAt(installment, installment.prepaidInstallments + paidRank)
    )
  }, 0)
}

/**
 * Month-by-month load from `today` until the last installment ends. Months
 * without any rate are kept as empty entries so the series stays contiguous.
 */
function buildTimeline(
  installments: InstallmentPlanWithStats[],
  snapshot: InstallmentSnapshot,
  today: string,
): InstallmentTimelineMonth[] {
  const byMonth = new Map<string, InstallmentTimelineEntry[]>()
  let lastMonth = ''

  for (const installment of installments) {
    const months = snapshot.projectedMonths.get(installment.id) ?? []
    const settled = snapshot.finalRatePaid.get(installment.id) ?? false
    for (const [index, month] of months.entries()) {
      const entries = byMonth.get(month) ?? []
      entries.push({
        installmentId: installment.id,
        name: installment.name,
        amount: projectedRateAmount(installment, index, settled),
      })
      byMonth.set(month, entries)
      if (month > lastMonth) lastMonth = month
    }
  }

  const timeline: InstallmentTimelineMonth[] = []
  let month = today
  while (lastMonth && month <= lastMonth) {
    const entries = byMonth.get(month) ?? []
    const total = entries.reduce((sum, entry) => sum + entry.amount, 0)
    timeline.push({ month, entries, total })
    month = nextMonth(month)
  }

  return timeline
}

/**
 * The running installments and what they cost — everything a caller needs that
 * does not care about the paid-off plans or the month-by-month timeline.
 * @param today - Month (YYYY-MM) the projection starts from
 */
export async function getInstallmentSummary(
  today: string,
): Promise<InstallmentSummary> {
  return summarize(await loadInstallmentSnapshot(today), today)
}

/** Filter a snapshot down to its running plans and sum what they cost. */
function summarize(
  snapshot: InstallmentSnapshot,
  today: string,
): InstallmentSummary {
  const running = snapshot.plans.filter(isRunning)

  return {
    running,
    aggregates: {
      currentMonthlyLoad: sumCurrentMonthlyLoad(running, snapshot, today),
      totalRemainingSum: running.reduce(
        (total, installment) => total + installment.remainingSum,
        0,
      ),
    },
  }
}

/**
 * Everything the Ratenzahlungen overview page needs: the installments with
 * their counters, the aggregates and the projected monthly load.
 * @param today - Month (YYYY-MM) the projection starts from
 */
export async function getInstallmentOverview(
  today: string,
): Promise<InstallmentOverview> {
  const snapshot = await loadInstallmentSnapshot(today)
  const { running, aggregates } = summarize(snapshot, today)

  return {
    installments: snapshot.plans,
    aggregates,
    timeline: buildTimeline(running, snapshot, today),
  }
}
