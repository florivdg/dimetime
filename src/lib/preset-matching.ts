import { transactionPreset } from '@/db/schema/plans'

type TransactionPreset = typeof transactionPreset.$inferSelect

function matchesQuarterlyRecurrence(
  startMonth: string,
  planMonth: string,
): boolean {
  const [startYear, startMonthNum] = startMonth.split('-').map(Number)
  const [planYear, planMonthNum] = planMonth.split('-').map(Number)
  const monthsDiff =
    (planYear - startYear) * 12 + (planMonthNum - startMonthNum)
  return monthsDiff >= 0 && monthsDiff % 3 === 0
}

function matchesYearlyRecurrence(
  startMonth: string,
  planMonth: string,
): boolean {
  const startMonthNum = parseInt(startMonth.split('-')[1], 10)
  const planMonthNum = parseInt(planMonth.split('-')[1], 10)
  return planMonthNum === startMonthNum && planMonth >= startMonth
}

const recurrenceMatchers: Record<
  TransactionPreset['recurrence'],
  (startMonth: string, planMonth: string) => boolean
> = {
  einmalig: (start, plan) => plan === start,
  monatlich: (start, plan) => plan >= start,
  vierteljährlich: matchesQuarterlyRecurrence,
  jährlich: matchesYearlyRecurrence,
}

function matchesRecurrence(
  recurrence: TransactionPreset['recurrence'],
  startMonth: string,
  planMonth: string,
): boolean {
  return recurrenceMatchers[recurrence]?.(startMonth, planMonth) ?? false
}

function isPresetWithinRange(
  startMonth: string,
  endDate: string | null,
  planMonth: string,
): boolean {
  if (planMonth < startMonth) return false
  const endMonth = endDate?.substring(0, 7)
  return !endMonth || planMonth <= endMonth
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
  if (!startMonth) return true
  if (!isPresetWithinRange(startMonth, preset.endDate, planMonth)) return false
  return matchesRecurrence(preset.recurrence, startMonth, planMonth)
}
