import { describe, expect, it } from 'bun:test'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-vue-next'
import { getSortIcon } from './useSortIcon'

describe('getSortIcon', () => {
  it('returns ArrowUpDown when columns differ', () => {
    expect(getSortIcon<'name' | 'date'>('name', 'asc', 'date')).toBe(
      ArrowUpDown,
    )
  })

  it('returns ArrowUp when column matches and direction is asc', () => {
    expect(getSortIcon<'name'>('name', 'asc', 'name')).toBe(ArrowUp)
  })

  it('returns ArrowDown when column matches and direction is desc', () => {
    expect(getSortIcon<'name'>('name', 'desc', 'name')).toBe(ArrowDown)
  })
})
