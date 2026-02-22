import { describe, expect, it } from 'bun:test'
import {
  normalizeForMatching,
  buildMerchantFingerprint,
  tokenizeForMatching,
  calculateTokenOverlapScore,
  directionFromAmountCents,
  isoDateDistanceInDays,
} from './kassensturz-matching'

describe('normalizeForMatching', () => {
  it('strips diacritics', () => {
    expect(normalizeForMatching('Büro')).toBe('buro')
    expect(normalizeForMatching('Ärger')).toBe('arger')
    expect(normalizeForMatching('Ölfilm')).toBe('olfilm')
    expect(normalizeForMatching('Über')).toBe('uber')
  })

  it('removes legal suffixes', () => {
    expect(normalizeForMatching('Firma GmbH')).toBe('firma')
    expect(normalizeForMatching('Verein AG')).toBe('verein')
  })

  it('removes digits', () => {
    expect(normalizeForMatching('Shop 123')).toBe('shop')
  })

  it('returns empty string for null/undefined/empty', () => {
    expect(normalizeForMatching(null)).toBe('')
    expect(normalizeForMatching(undefined)).toBe('')
    expect(normalizeForMatching('')).toBe('')
  })

  it('lowercases and removes special chars', () => {
    expect(normalizeForMatching('HELLO-WORLD!')).toBe('hello world')
  })
})

describe('buildMerchantFingerprint', () => {
  it('uses counterparty as first priority', () => {
    const result = buildMerchantFingerprint({
      counterparty: 'Max Mustermann',
      description: 'Zahlung',
      purpose: 'Miete',
      bookingText: 'SEPA',
    })
    expect(result).toBe('max mustermann')
  })

  it('falls back to description when counterparty is null', () => {
    const result = buildMerchantFingerprint({
      counterparty: null,
      description: 'Amazon Marketplace',
    })
    expect(result).toBe('amazon marketplace')
  })

  it('falls back to purpose', () => {
    const result = buildMerchantFingerprint({
      counterparty: null,
      description: null,
      purpose: 'Miete Januar',
    })
    expect(result).toContain('miete')
  })

  it('falls back to bookingText', () => {
    const result = buildMerchantFingerprint({
      counterparty: null,
      description: null,
      purpose: null,
      bookingText: 'Lastschrift REWE',
    })
    expect(result).toContain('rewe')
  })

  it('returns empty string when all fields are null', () => {
    expect(
      buildMerchantFingerprint({
        counterparty: null,
        description: null,
        purpose: null,
        bookingText: null,
      }),
    ).toBe('')
  })
})

describe('tokenizeForMatching', () => {
  it('tokenizes and returns a set of strings', () => {
    const tokens = tokenizeForMatching('Max Mustermann Berlin')
    expect(tokens).toBeInstanceOf(Set)
    expect(tokens.has('max')).toBe(true)
    expect(tokens.has('mustermann')).toBe(true)
    expect(tokens.has('berlin')).toBe(true)
  })

  it('filters stop words', () => {
    const tokens = tokenizeForMatching('der SEPA die Lastschrift das Zahlung')
    expect(tokens.has('der')).toBe(false)
    expect(tokens.has('sepa')).toBe(false)
    expect(tokens.has('die')).toBe(false)
    expect(tokens.has('das')).toBe(false)
    expect(tokens.has('zahlung')).toBe(false)
    expect(tokens.has('lastschrift')).toBe(false)
  })

  it('filters tokens shorter than 2 characters', () => {
    const tokens = tokenizeForMatching('a b cd ef')
    expect(tokens.has('a')).toBe(false)
    expect(tokens.has('b')).toBe(false)
    expect(tokens.has('cd')).toBe(true)
    expect(tokens.has('ef')).toBe(true)
  })

  it('returns empty set for empty input', () => {
    expect(tokenizeForMatching('').size).toBe(0)
  })
})

describe('calculateTokenOverlapScore', () => {
  it('returns maxScore for identical strings', () => {
    expect(calculateTokenOverlapScore('Rewe Markt', 'Rewe Markt')).toBe(20)
  })

  it('returns 0 for no overlap', () => {
    expect(calculateTokenOverlapScore('alpha beta', 'gamma delta')).toBe(0)
  })

  it('returns proportional score for partial overlap', () => {
    const score = calculateTokenOverlapScore(
      'rewe supermarkt berlin',
      'rewe filiale münchen',
    )
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(20)
  })

  it('respects custom maxScore', () => {
    const score = calculateTokenOverlapScore('Rewe Markt', 'Rewe Markt', 100)
    expect(score).toBe(100)
  })

  it('returns 0 when one side is empty', () => {
    expect(calculateTokenOverlapScore('', 'hello')).toBe(0)
    expect(calculateTokenOverlapScore('hello', '')).toBe(0)
  })
})

describe('directionFromAmountCents', () => {
  it('returns income for positive amounts', () => {
    expect(directionFromAmountCents(1000)).toBe('income')
  })

  it('returns expense for negative amounts', () => {
    expect(directionFromAmountCents(-500)).toBe('expense')
  })

  it('returns null for zero', () => {
    expect(directionFromAmountCents(0)).toBeNull()
  })
})

describe('isoDateDistanceInDays', () => {
  it('returns 0 for same date', () => {
    expect(isoDateDistanceInDays('2024-01-15', '2024-01-15')).toBe(0)
  })

  it('returns 1 for adjacent days', () => {
    expect(isoDateDistanceInDays('2024-01-15', '2024-01-16')).toBe(1)
  })

  it('is symmetric', () => {
    const a = isoDateDistanceInDays('2024-01-10', '2024-01-20')
    const b = isoDateDistanceInDays('2024-01-20', '2024-01-10')
    expect(a).toBe(b)
    expect(a).toBe(10)
  })

  it('returns Infinity for invalid dates', () => {
    expect(isoDateDistanceInDays('not-a-date', '2024-01-01')).toBe(Infinity)
    expect(isoDateDistanceInDays('2024-01-01', 'invalid')).toBe(Infinity)
  })
})
