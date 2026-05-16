import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { paginationFields, sortDirField } from './pagination-schema'

const schema = z.object(paginationFields)

describe('paginationFields', () => {
  it('defaults page=1 and limit=20', () => {
    const parsed = schema.parse({})
    expect(parsed.page).toBe(1)
    expect(parsed.limit).toBe(20)
  })

  it('accepts numeric strings (coerce)', () => {
    const parsed = schema.parse({ page: '3', limit: '50' })
    expect(parsed.page).toBe(3)
    expect(parsed.limit).toBe(50)
  })

  it('accepts the sentinel limit=-1 (unbounded)', () => {
    const parsed = schema.parse({ limit: -1 })
    expect(parsed.limit).toBe(-1)
  })

  it('rejects limit=0', () => {
    expect(() => schema.parse({ limit: 0 })).toThrow()
  })

  it('rejects limit above 100', () => {
    expect(() => schema.parse({ limit: 101 })).toThrow()
  })

  it('rejects page=0', () => {
    expect(() => schema.parse({ page: 0 })).toThrow()
  })
})

describe('sortDirField', () => {
  it('accepts asc and desc', () => {
    expect(sortDirField.parse('asc')).toBe('asc')
    expect(sortDirField.parse('desc')).toBe('desc')
  })

  it('treats undefined as undefined (optional)', () => {
    expect(sortDirField.parse(undefined)).toBeUndefined()
  })

  it('rejects unknown values', () => {
    expect(() => sortDirField.parse('sideways')).toThrow()
  })
})
