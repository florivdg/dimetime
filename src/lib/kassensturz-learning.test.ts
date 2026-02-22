import { describe, expect, it } from 'bun:test'
import { computeKassensturzLearningStats } from '@/lib/kassensturz-learning'

describe('computeKassensturzLearningStats', () => {
  it('creates initial stats for first confirmation', () => {
    const stats = computeKassensturzLearningStats({
      newAmountCents: -4999,
    })

    expect(stats).toEqual({
      avgAmountCents: 4999,
      amountToleranceCents: 150,
      confirmCount: 1,
    })
  })

  it('increments confirm count and updates moving average', () => {
    const stats = computeKassensturzLearningStats({
      existingAvgAmountCents: 10000,
      existingConfirmCount: 1,
      newAmountCents: -11000,
    })

    expect(stats).toEqual({
      avgAmountCents: 10500,
      amountToleranceCents: 315,
      confirmCount: 2,
    })
  })

  it('keeps minimum tolerance for small amounts', () => {
    const stats = computeKassensturzLearningStats({
      existingAvgAmountCents: 900,
      existingConfirmCount: 2,
      newAmountCents: 1000,
    })

    expect(stats.confirmCount).toBe(3)
    expect(stats.avgAmountCents).toBe(933)
    expect(stats.amountToleranceCents).toBe(100)
  })
})
