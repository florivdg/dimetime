import { normalizeText } from '@/lib/bank-import/normalize'

export type KassensturzDirection = 'income' | 'expense'

const MERCHANT_LEGAL_SUFFIX_RE =
  /\b(gmbh|ag|kg|mbh|ug|eg|e\.k\.|ek|ev|e\.v\.)\b/g

const STOP_WORDS = new Set([
  'der',
  'die',
  'das',
  'und',
  'oder',
  'the',
  'shop',
  'markt',
  'store',
  'zahlung',
  'lastschrift',
  'sepa',
])

function stripDiacritics(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
}

export function normalizeForMatching(value: string | null | undefined): string {
  const normalized = normalizeText(value)
  if (!normalized) return ''

  return stripDiacritics(normalized)
    .toLowerCase()
    .replace(MERCHANT_LEGAL_SUFFIX_RE, ' ')
    .replace(/\d+/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildMerchantFingerprint(input: {
  counterparty?: string | null
  description?: string | null
  purpose?: string | null
  bookingText?: string | null
}): string {
  const firstNonEmpty =
    normalizeText(input.counterparty) ??
    normalizeText(input.description) ??
    normalizeText(input.purpose) ??
    normalizeText(input.bookingText)

  return normalizeForMatching(firstNonEmpty)
}

export function normalizePlannedTargetName(name: string): string {
  return normalizeForMatching(name)
}

export function tokenizeForMatching(value: string): Set<string> {
  const normalized = normalizeForMatching(value)
  if (!normalized) return new Set()

  return new Set(
    normalized
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 && !STOP_WORDS.has(token)),
  )
}

export function calculateTokenOverlapScore(
  left: string,
  right: string,
  maxScore = 20,
): number {
  const leftTokens = tokenizeForMatching(left)
  const rightTokens = tokenizeForMatching(right)
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0

  let overlap = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1
  }

  if (overlap === 0) return 0
  const denominator = Math.max(leftTokens.size, rightTokens.size)
  const ratio = overlap / denominator
  return Math.round(maxScore * ratio)
}

export function directionFromAmountCents(
  amountCents: number,
): KassensturzDirection | null {
  if (amountCents > 0) return 'income'
  if (amountCents < 0) return 'expense'
  return null
}

export function isoDateDistanceInDays(
  leftIso: string,
  rightIso: string,
): number {
  const leftTs = Date.parse(`${leftIso}T00:00:00Z`)
  const rightTs = Date.parse(`${rightIso}T00:00:00Z`)
  if (!Number.isFinite(leftTs) || !Number.isFinite(rightTs)) {
    return Number.POSITIVE_INFINITY
  }
  const deltaMs = Math.abs(leftTs - rightTs)
  return Math.floor(deltaMs / (24 * 60 * 60 * 1000))
}
