import { describe, expect, it } from 'bun:test'
import { partitionByPlan } from './plan-partition'

describe('partitionByPlan', () => {
  it('returns empty buckets for empty input', () => {
    const result = partitionByPlan([], 'plan-1')
    expect(result).toEqual({ idsToClearBudget: [], idsToKeepBudget: [] })
  })

  it('keeps items whose planId matches the target planId', () => {
    const result = partitionByPlan(
      [
        { id: 'a', planId: 'plan-1' },
        { id: 'b', planId: 'plan-1' },
      ],
      'plan-1',
    )
    expect(result.idsToKeepBudget).toEqual(['a', 'b'])
    expect(result.idsToClearBudget).toEqual([])
  })

  it('clears items whose planId differs', () => {
    const result = partitionByPlan(
      [
        { id: 'a', planId: 'plan-1' },
        { id: 'b', planId: 'plan-2' },
      ],
      'plan-1',
    )
    expect(result.idsToKeepBudget).toEqual(['a'])
    expect(result.idsToClearBudget).toEqual(['b'])
  })

  it('clears all items when target planId is null', () => {
    const result = partitionByPlan(
      [
        { id: 'a', planId: 'plan-1' },
        { id: 'b', planId: null },
      ],
      null,
    )
    expect(result.idsToKeepBudget).toEqual([])
    expect(result.idsToClearBudget).toEqual(['a', 'b'])
  })

  it('clears items whose current planId is null even if target is non-null', () => {
    const result = partitionByPlan([{ id: 'a', planId: null }], 'plan-1')
    expect(result.idsToClearBudget).toEqual(['a'])
    expect(result.idsToKeepBudget).toEqual([])
  })
})
