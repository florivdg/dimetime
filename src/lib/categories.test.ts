import { describe, expect, it } from 'bun:test'
import { generateSlug } from './categories'

describe('generateSlug', () => {
  it('lowercases input', () => {
    expect(generateSlug('Hello World')).toBe('hello-world')
  })

  it('replaces special chars with hyphens', () => {
    expect(generateSlug('Food & Drinks')).toBe('food-drinks')
    expect(generateSlug('a/b/c')).toBe('a-b-c')
  })

  it('strips diacritics', () => {
    expect(generateSlug('Büroartikel')).toBe('buroartikel')
    expect(generateSlug('Ärzte')).toBe('arzte')
    expect(generateSlug('Ölgemälde')).toBe('olgemalde')
    expect(generateSlug('Übersee')).toBe('ubersee')
  })

  it('trims leading and trailing hyphens', () => {
    expect(generateSlug('--hello--')).toBe('hello')
    expect(generateSlug('  spaces  ')).toBe('spaces')
  })

  it('handles complex mixed input', () => {
    expect(generateSlug('Café & Bäckerei')).toBe('cafe-backerei')
  })
})
