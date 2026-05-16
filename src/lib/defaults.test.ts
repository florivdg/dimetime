import { describe, expect, it } from 'bun:test'
import { orDefault, orNull } from './defaults'

describe('orNull', () => {
  it('returns the value when defined', () => {
    expect(orNull('hi')).toBe('hi')
    expect(orNull(0)).toBe(0)
    expect(orNull(false)).toBe(false)
  })

  it('returns null for null', () => {
    expect(orNull(null)).toBe(null)
  })

  it('returns null for undefined', () => {
    expect(orNull(undefined)).toBe(null)
  })
})

describe('orDefault', () => {
  it('returns the value when defined and non-nullish', () => {
    expect(orDefault('hello', 'fallback')).toBe('hello')
    expect(orDefault(0, 99)).toBe(0)
    expect(orDefault(false, true)).toBe(false)
  })

  it('returns fallback for null', () => {
    expect(orDefault(null, 'fallback')).toBe('fallback')
  })

  it('returns fallback for undefined', () => {
    expect(orDefault(undefined, 'fallback')).toBe('fallback')
  })
})
