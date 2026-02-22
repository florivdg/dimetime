import { db } from '@/db/database'
import { bankTransaction, kassensturzMatchRule } from '@/db/schema/plans'
import { and, eq, inArray } from 'drizzle-orm'
import {
  getKassensturzData,
  type KassensturzAutoAppliedMatch,
  type KassensturzAutoCandidate,
  type KassensturzAutoReasonCode,
  type KassensturzAutoRunResult,
  type KassensturzPlannedItem,
} from '@/lib/kassensturz'
import { createAutoReconciliationSafely } from '@/lib/bank-transactions'
import {
  buildMerchantFingerprint,
  calculateTokenOverlapScore,
  directionFromAmountCents,
  isoDateDistanceInDays,
  normalizePlannedTargetName,
} from '@/lib/kassensturz-matching'

export const AUTO_THRESHOLD = 85
export const SUGGEST_THRESHOLD = 65
export const AMBIGUITY_DELTA = 8
const RULE_LOCK_SCORE = 90

interface ScoredCandidate extends KassensturzAutoCandidate {
  score: number
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}

function buildRuleLookupKey(input: {
  sourceId: string
  direction: 'income' | 'expense'
  merchantFingerprint: string
  targetPlannedNameNormalized: string
}): string {
  return `${input.sourceId}|${input.direction}|${input.merchantFingerprint}|${input.targetPlannedNameNormalized}`
}

export function scoreKassensturzCandidate(input: {
  tx: {
    bookingDate: string
    amountCents: number
    merchantFingerprint: string
    sourceId: string
  }
  planned: Pick<
    KassensturzPlannedItem,
    'id' | 'name' | 'note' | 'amount' | 'dueDate' | 'status'
  >
  hasRule: boolean
}): ScoredCandidate {
  let score = 0
  const reasonCodes: KassensturzAutoReasonCode[] = []

  if (input.hasRule) {
    // Learned merchant rules should dominate amount variance for recurring spend.
    score += RULE_LOCK_SCORE
    reasonCodes.push('RULE_MERCHANT_SOURCE')
  }

  const similarityText =
    `${input.planned.name} ${input.planned.note ?? ''}`.trim()
  const similarityScore = calculateTokenOverlapScore(
    input.tx.merchantFingerprint,
    similarityText,
    20,
  )
  if (similarityScore > 0) {
    score += similarityScore
    reasonCodes.push('TEXT_SIMILARITY')
  }

  if (!input.hasRule) {
    const deltaAmount = Math.abs(
      Math.abs(input.tx.amountCents) - Math.abs(input.planned.amount),
    )
    const plannedAbs = Math.abs(input.planned.amount)
    const relativeTolerance = Math.max(200, Math.round(plannedAbs * 0.02))

    if (deltaAmount === 0) {
      score += 25
      reasonCodes.push('AMOUNT_EXACT')
    } else if (deltaAmount <= 100) {
      score += 20
      reasonCodes.push('AMOUNT_NEAR')
    } else if (deltaAmount <= relativeTolerance) {
      score += 12
      reasonCodes.push('AMOUNT_TOLERANCE')
    }
  }

  const dueDateDistance = isoDateDistanceInDays(
    input.tx.bookingDate,
    input.planned.dueDate,
  )
  if (dueDateDistance <= 3) {
    score += 10
    reasonCodes.push('DUEDATE_NEAR')
  } else if (dueDateDistance <= 7) {
    score += 7
    reasonCodes.push('DUEDATE_NEAR')
  } else if (dueDateDistance <= 14) {
    score += 3
    reasonCodes.push('DUEDATE_NEAR')
  }

  if (!input.hasRule) {
    if (input.planned.status === 'erfuellt') {
      score -= 10
      reasonCodes.push('STATUS_PENALTY')
    } else if (input.planned.status === 'ueberzogen') {
      score -= 20
      reasonCodes.push('STATUS_PENALTY')
    }
  }

  const confidence = clampScore(score)
  return {
    plannedTransactionId: input.planned.id,
    confidence,
    reasonCodes,
    score,
  }
}

export type AutoMatchDecision =
  | { kind: 'none' }
  | { kind: 'auto'; candidate: KassensturzAutoCandidate }
  | { kind: 'suggest'; candidates: KassensturzAutoCandidate[] }
  | { kind: 'ambiguous'; candidates: KassensturzAutoCandidate[] }

export function decideKassensturzAutoMatch(
  scoredCandidates: KassensturzAutoCandidate[],
): AutoMatchDecision {
  const top = scoredCandidates[0]
  if (!top) return { kind: 'none' }

  const second = scoredCandidates[1]
  const isAmbiguous =
    Boolean(second) &&
    top.confidence >= SUGGEST_THRESHOLD &&
    top.confidence - second.confidence < AMBIGUITY_DELTA

  if (isAmbiguous) {
    const candidates = scoredCandidates
      .filter((candidate) => candidate.confidence >= SUGGEST_THRESHOLD)
      .slice(0, 2)
    return candidates.length === 0
      ? { kind: 'none' }
      : { kind: 'ambiguous', candidates }
  }

  if (top.confidence >= AUTO_THRESHOLD) {
    return { kind: 'auto', candidate: top }
  }

  if (top.confidence >= SUGGEST_THRESHOLD) {
    return { kind: 'suggest', candidates: [top] }
  }

  return { kind: 'none' }
}

function buildInitialResult(): KassensturzAutoRunResult {
  return {
    stats: {
      processed: 0,
      matched: 0,
      suggested: 0,
      skippedAmbiguous: 0,
      skippedNoCandidate: 0,
    },
    applied: [],
    suggestions: [],
  }
}

function toAppliedMatch(input: {
  bankTransactionId: string
  candidate: KassensturzAutoCandidate
}): KassensturzAutoAppliedMatch {
  return {
    bankTransactionId: input.bankTransactionId,
    plannedTransactionId: input.candidate.plannedTransactionId,
    confidence: input.candidate.confidence,
    reasonCodes: input.candidate.reasonCodes,
  }
}

export async function runKassensturzAutoReconcile(input: {
  planId: string
  dryRun?: boolean
  matchedByUserId?: string | null
}): Promise<KassensturzAutoRunResult> {
  const dryRun = input.dryRun ?? false
  const result = buildInitialResult()
  const kassensturzData = await getKassensturzData(input.planId)
  const unmatchedIds = kassensturzData.unmatchedBankTransactions.map(
    (tx) => tx.id,
  )

  if (unmatchedIds.length === 0) {
    return result
  }

  const unresolvedTransactions = await db
    .select({
      id: bankTransaction.id,
      sourceId: bankTransaction.sourceId,
      bookingDate: bankTransaction.bookingDate,
      amountCents: bankTransaction.amountCents,
      counterparty: bankTransaction.counterparty,
      description: bankTransaction.description,
      purpose: bankTransaction.purpose,
      bookingText: bankTransaction.bookingText,
    })
    .from(bankTransaction)
    .where(
      and(
        eq(bankTransaction.planId, input.planId),
        inArray(bankTransaction.id, unmatchedIds),
      ),
    )

  if (unresolvedTransactions.length === 0) {
    return result
  }

  const sourceIds = [
    ...new Set(unresolvedTransactions.map((tx) => tx.sourceId)),
  ]
  const rules =
    sourceIds.length === 0
      ? []
      : await db
          .select()
          .from(kassensturzMatchRule)
          .where(
            and(
              inArray(kassensturzMatchRule.sourceId, sourceIds),
              eq(kassensturzMatchRule.active, true),
            ),
          )

  const activeRuleLookup = new Set(
    rules.map((rule) =>
      buildRuleLookupKey({
        sourceId: rule.sourceId,
        direction: rule.direction,
        merchantFingerprint: rule.merchantFingerprint,
        targetPlannedNameNormalized: rule.targetPlannedNameNormalized,
      }),
    ),
  )

  const txById = new Map(unresolvedTransactions.map((tx) => [tx.id, tx]))

  for (const tx of kassensturzData.unmatchedBankTransactions) {
    result.stats.processed += 1
    const fullTx = txById.get(tx.id)
    if (!fullTx) {
      result.stats.skippedNoCandidate += 1
      continue
    }

    const direction = directionFromAmountCents(fullTx.amountCents)
    if (!direction) {
      result.stats.skippedNoCandidate += 1
      continue
    }

    const merchantFingerprint = buildMerchantFingerprint({
      counterparty: fullTx.counterparty,
      description: fullTx.description,
      purpose: fullTx.purpose,
      bookingText: fullTx.bookingText,
    })
    if (!merchantFingerprint) {
      result.stats.skippedNoCandidate += 1
      continue
    }

    const scoredCandidates: ScoredCandidate[] = kassensturzData.plannedItems
      .filter((planned) => planned.type === direction)
      .map((planned) => {
        const targetPlannedNameNormalized = normalizePlannedTargetName(
          planned.name,
        )
        const hasRule = activeRuleLookup.has(
          buildRuleLookupKey({
            sourceId: fullTx.sourceId,
            direction,
            merchantFingerprint,
            targetPlannedNameNormalized,
          }),
        )

        return scoreKassensturzCandidate({
          tx: {
            bookingDate: tx.bookingDate,
            amountCents: tx.amountCents,
            merchantFingerprint,
            sourceId: fullTx.sourceId,
          },
          planned,
          hasRule,
        })
      })
      .sort((left, right) => right.score - left.score)

    const decision = decideKassensturzAutoMatch(scoredCandidates)

    if (decision.kind === 'none') {
      result.stats.skippedNoCandidate += 1
      continue
    }

    if (decision.kind === 'ambiguous') {
      result.stats.skippedAmbiguous += 1
      result.stats.suggested += 1
      result.suggestions.push({
        bankTransactionId: tx.id,
        candidates: decision.candidates,
      })
      continue
    }

    if (decision.kind === 'auto') {
      const candidate = decision.candidate

      if (dryRun) {
        result.stats.matched += 1
        result.applied.push(
          toAppliedMatch({
            bankTransactionId: tx.id,
            candidate,
          }),
        )
        continue
      }

      const createResult = await createAutoReconciliationSafely({
        bankTransactionId: tx.id,
        plannedTransactionId: candidate.plannedTransactionId,
        confidence: candidate.confidence,
        matchedByUserId: input.matchedByUserId ?? null,
      })

      if (createResult.status === 'created') {
        result.stats.matched += 1
        result.applied.push(
          toAppliedMatch({
            bankTransactionId: tx.id,
            candidate,
          }),
        )
      } else {
        result.stats.skippedNoCandidate += 1
      }

      continue
    }

    if (decision.kind === 'suggest') {
      result.stats.suggested += 1
      result.suggestions.push({
        bankTransactionId: tx.id,
        candidates: decision.candidates,
      })
      continue
    }
  }

  return result
}
