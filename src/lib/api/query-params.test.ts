import { describe, expect, it } from 'bun:test'
import { parseQueryParams } from './query-params'

describe('parseQueryParams', () => {
  it('returns undefined for every key when no params present', () => {
    const result = parseQueryParams(new URLSearchParams(), [
      'search',
      'page',
    ] as const)
    expect(result).toEqual({ search: undefined, page: undefined })
  })

  it('returns string values for keys that are set', () => {
    const result = parseQueryParams(new URLSearchParams('search=foo&page=2'), [
      'search',
      'page',
      'missing',
    ] as const)
    expect(result.search).toBe('foo')
    expect(result.page).toBe('2')
    expect(result.missing).toBeUndefined()
  })

  it('treats empty string param as undefined', () => {
    const result = parseQueryParams(new URLSearchParams('search='), [
      'search',
    ] as const)
    expect(result.search).toBeUndefined()
  })
})
