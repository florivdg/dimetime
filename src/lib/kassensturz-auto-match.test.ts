import { describe, expect, it } from 'bun:test'
import {
  decideKassensturzAutoMatch,
  scoreKassensturzCandidate,
} from '@/lib/kassensturz-auto-match'

describe('kassensturz auto match scoring', () => {
  it('auto-matches learned merchant rules even with different amount', () => {
    const scored = scoreKassensturzCandidate({
      tx: {
        bookingDate: '2026-02-10',
        amountCents: -12999,
        merchantFingerprint: 'rewe',
        sourceId: 'source-1',
      },
      planned: {
        id: 'planned-1',
        name: 'Rewe Einkauf',
        note: null,
        amount: 6499,
        dueDate: '2026-02-10',
        status: 'offen',
      },
      hasRule: true,
    })

    expect(scored.confidence).toBeGreaterThanOrEqual(85)
    expect(scored.reasonCodes).toContain('RULE_MERCHANT_SOURCE')
    expect(scored.reasonCodes).toContain('DUEDATE_NEAR')
    expect(scored.reasonCodes).not.toContain('AMOUNT_EXACT')
    expect(scored.reasonCodes).not.toContain('AMOUNT_NEAR')
    expect(scored.reasonCodes).not.toContain('AMOUNT_TOLERANCE')
    expect(decideKassensturzAutoMatch([scored]).kind).toBe('auto')
  })

  it('keeps learned merchant rule on auto even when item is overdrawn', () => {
    const scored = scoreKassensturzCandidate({
      tx: {
        bookingDate: '2026-02-10',
        amountCents: -15000,
        merchantFingerprint: 'netflix',
        sourceId: 'source-1',
      },
      planned: {
        id: 'planned-1',
        name: 'Netflix',
        note: null,
        amount: 5000,
        dueDate: '2026-02-10',
        status: 'ueberzogen',
      },
      hasRule: true,
    })

    const decision = decideKassensturzAutoMatch([scored])
    expect(scored.confidence).toBeGreaterThanOrEqual(85)
    expect(scored.reasonCodes).not.toContain('STATUS_PENALTY')
    expect(decision.kind).toBe('auto')
  })

  it('still penalizes overdrawn non-rule candidates', () => {
    const scored = scoreKassensturzCandidate({
      tx: {
        bookingDate: '2026-02-10',
        amountCents: -5000,
        merchantFingerprint: 'sonstiger haendler',
        sourceId: 'source-1',
      },
      planned: {
        id: 'planned-1',
        name: 'Streaming',
        note: null,
        amount: 5000,
        dueDate: '2026-02-10',
        status: 'ueberzogen',
      },
      hasRule: false,
    })

    expect(scored.reasonCodes).toContain('STATUS_PENALTY')
  })

  it('returns ambiguous when top candidates are too close', () => {
    const decision = decideKassensturzAutoMatch([
      {
        plannedTransactionId: 'planned-1',
        confidence: 84,
        reasonCodes: ['TEXT_SIMILARITY'],
      },
      {
        plannedTransactionId: 'planned-2',
        confidence: 79,
        reasonCodes: ['TEXT_SIMILARITY'],
      },
    ])

    expect(decision.kind).toBe('ambiguous')
    if (decision.kind === 'ambiguous') {
      expect(decision.candidates.length).toBe(2)
    }
  })

  it('returns none when no candidates are available (e.g. type mismatch)', () => {
    const decision = decideKassensturzAutoMatch([])
    expect(decision.kind).toBe('none')
  })
})
