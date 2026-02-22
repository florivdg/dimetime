import { db } from '@/db/database'
import {
  bankTransaction,
  kassensturzMatchRule,
  plannedTransaction,
} from '@/db/schema/plans'
import { and, eq } from 'drizzle-orm'
import {
  buildMerchantFingerprint,
  directionFromAmountCents,
  normalizePlannedTargetName,
  type KassensturzDirection,
} from '@/lib/kassensturz-matching'

export interface KassensturzLearningStats {
  avgAmountCents: number
  amountToleranceCents: number
  confirmCount: number
}

export function computeKassensturzLearningStats(input: {
  existingAvgAmountCents?: number
  existingConfirmCount?: number
  newAmountCents: number
}): KassensturzLearningStats {
  const existingCount = Math.max(0, input.existingConfirmCount ?? 0)
  const existingAvg = Math.max(0, input.existingAvgAmountCents ?? 0)
  const nextCount = existingCount + 1
  const normalizedAmount = Math.abs(input.newAmountCents)

  const nextAvg =
    existingCount === 0
      ? normalizedAmount
      : Math.round((existingAvg * existingCount + normalizedAmount) / nextCount)
  const nextTolerance = Math.max(100, Math.round(nextAvg * 0.03))

  return {
    avgAmountCents: nextAvg,
    amountToleranceCents: nextTolerance,
    confirmCount: nextCount,
  }
}

function fallbackDirection(
  amountDirection: KassensturzDirection | null,
  plannedType: 'income' | 'expense',
): KassensturzDirection {
  if (amountDirection) return amountDirection
  return plannedType
}

export async function learnFromManualReconciliation(input: {
  planId: string
  bankTransactionId: string
  plannedTransactionId: string
}) {
  const [bankTx, plannedTx] = await Promise.all([
    db.query.bankTransaction.findFirst({
      where: and(
        eq(bankTransaction.id, input.bankTransactionId),
        eq(bankTransaction.planId, input.planId),
      ),
    }),
    db.query.plannedTransaction.findFirst({
      where: and(
        eq(plannedTransaction.id, input.plannedTransactionId),
        eq(plannedTransaction.planId, input.planId),
      ),
    }),
  ])

  if (!bankTx || !plannedTx) {
    return null
  }

  const merchantFingerprint = buildMerchantFingerprint({
    counterparty: bankTx.counterparty,
    description: bankTx.description,
    purpose: bankTx.purpose,
    bookingText: bankTx.bookingText,
  })
  if (!merchantFingerprint) {
    return null
  }

  const direction = fallbackDirection(
    directionFromAmountCents(bankTx.amountCents),
    plannedTx.type,
  )
  const targetPlannedNameNormalized = normalizePlannedTargetName(plannedTx.name)
  const existingRule = await db.query.kassensturzMatchRule.findFirst({
    where: and(
      eq(kassensturzMatchRule.sourceId, bankTx.sourceId),
      eq(kassensturzMatchRule.direction, direction),
      eq(kassensturzMatchRule.merchantFingerprint, merchantFingerprint),
      eq(
        kassensturzMatchRule.targetPlannedNameNormalized,
        targetPlannedNameNormalized,
      ),
    ),
  })

  const stats = computeKassensturzLearningStats({
    existingAvgAmountCents: existingRule?.avgAmountCents,
    existingConfirmCount: existingRule?.confirmCount,
    newAmountCents: bankTx.amountCents,
  })

  if (!existingRule) {
    const now = new Date()
    const [createdRule] = await db
      .insert(kassensturzMatchRule)
      .values({
        sourceId: bankTx.sourceId,
        direction,
        merchantFingerprint,
        targetPlannedNameNormalized,
        targetCategoryId: plannedTx.categoryId ?? null,
        avgAmountCents: stats.avgAmountCents,
        amountToleranceCents: stats.amountToleranceCents,
        confirmCount: stats.confirmCount,
        active: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    return createdRule
  }

  const [updatedRule] = await db
    .update(kassensturzMatchRule)
    .set({
      targetCategoryId: plannedTx.categoryId ?? existingRule.targetCategoryId,
      avgAmountCents: stats.avgAmountCents,
      amountToleranceCents: stats.amountToleranceCents,
      confirmCount: stats.confirmCount,
      active: true,
      updatedAt: new Date(),
    })
    .where(eq(kassensturzMatchRule.id, existingRule.id))
    .returning()

  return updatedRule
}
