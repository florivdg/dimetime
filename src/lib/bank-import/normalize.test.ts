import { describe, expect, it } from 'bun:test'
import {
  normalizeText,
  normalizeCurrency,
  parseGermanDateToIso,
  parseGermanMoney,
  extractCardLast4,
  monthFromIsoDate,
} from './normalize'

describe('normalizeText', () => {
  it('returns null for null and undefined', () => {
    expect(normalizeText(null)).toBeNull()
    expect(normalizeText(undefined)).toBeNull()
  })

  it('returns null for empty or whitespace-only strings', () => {
    expect(normalizeText('')).toBeNull()
    expect(normalizeText('   ')).toBeNull()
    expect(normalizeText('\t\n')).toBeNull()
  })

  it('collapses whitespace and trims', () => {
    expect(normalizeText('  hello   world  ')).toBe('hello world')
    expect(normalizeText('a\t\nb')).toBe('a b')
  })

  it('coerces number to string', () => {
    expect(normalizeText(42)).toBe('42')
    expect(normalizeText(0)).toBe('0')
  })

  it('coerces boolean to string', () => {
    expect(normalizeText(true)).toBe('true')
    expect(normalizeText(false)).toBe('false')
  })

  it('coerces bigint to string', () => {
    expect(normalizeText(BigInt(123))).toBe('123')
  })

  it('returns null for objects and arrays', () => {
    expect(normalizeText({})).toBeNull()
    expect(normalizeText([])).toBeNull()
    expect(normalizeText({ toString: () => 'hi' })).toBeNull()
  })
})

describe('normalizeCurrency', () => {
  it('returns fallback for null/undefined/empty', () => {
    expect(normalizeCurrency(null)).toBe('EUR')
    expect(normalizeCurrency(undefined)).toBe('EUR')
    expect(normalizeCurrency('')).toBe('EUR')
  })

  it('converts euro sign to EUR', () => {
    expect(normalizeCurrency('€')).toBe('EUR')
  })

  it('uppercases currency codes', () => {
    expect(normalizeCurrency('usd')).toBe('USD')
    expect(normalizeCurrency('eur')).toBe('EUR')
  })

  it('uses custom fallback', () => {
    expect(normalizeCurrency(null, 'USD')).toBe('USD')
  })
})

describe('parseGermanDateToIso', () => {
  it('parses standard DD.MM.YYYY format', () => {
    expect(parseGermanDateToIso('01.01.2024')).toBe('2024-01-01')
    expect(parseGermanDateToIso('31.12.2023')).toBe('2023-12-31')
  })

  it('pads single-digit day and month', () => {
    expect(parseGermanDateToIso('1.2.2024')).toBe('2024-02-01')
    expect(parseGermanDateToIso('9.9.2023')).toBe('2023-09-09')
  })

  it('returns null for invalid formats', () => {
    expect(parseGermanDateToIso('2024-01-01')).toBeNull()
    expect(parseGermanDateToIso('invalid')).toBeNull()
    expect(parseGermanDateToIso('')).toBeNull()
  })
})

describe('parseGermanMoney', () => {
  it('parses negative amount with euro sign', () => {
    const result = parseGermanMoney('-20,67 €')
    expect(result).toEqual({ amountCents: -2067, currency: 'EUR' })
  })

  it('parses positive amount with thousand separators', () => {
    const result = parseGermanMoney('+2.100,00 EUR')
    expect(result).toEqual({ amountCents: 210000, currency: 'EUR' })
  })

  it('parses amount without currency sign', () => {
    const result = parseGermanMoney('-140,47')
    expect(result).toEqual({ amountCents: -14047, currency: 'EUR' })
  })

  it('parses amount without sign as positive', () => {
    const result = parseGermanMoney('50,00 €')
    expect(result).toEqual({ amountCents: 5000, currency: 'EUR' })
  })

  it('returns null for null/undefined/invalid', () => {
    expect(parseGermanMoney(null)).toBeNull()
    expect(parseGermanMoney(undefined)).toBeNull()
    expect(parseGermanMoney('abc')).toBeNull()
    expect(parseGermanMoney('')).toBeNull()
  })

  it('uses custom fallback currency', () => {
    const result = parseGermanMoney('10,00', 'USD')
    expect(result).toEqual({ amountCents: 1000, currency: 'USD' })
  })
})

describe('extractCardLast4', () => {
  it('extracts last 4 digits', () => {
    expect(extractCardLast4('1234567890')).toBe('7890')
    expect(extractCardLast4('**** **** **** 1234')).toBe('1234')
  })

  it('returns null if fewer than 4 digits', () => {
    expect(extractCardLast4('12')).toBeNull()
    expect(extractCardLast4('abc')).toBeNull()
  })

  it('returns null for null/undefined/empty', () => {
    expect(extractCardLast4(null)).toBeNull()
    expect(extractCardLast4(undefined)).toBeNull()
    expect(extractCardLast4('')).toBeNull()
  })
})

describe('monthFromIsoDate', () => {
  it('extracts YYYY-MM from ISO date', () => {
    expect(monthFromIsoDate('2024-03-15')).toBe('2024-03')
    expect(monthFromIsoDate('2023-12-01')).toBe('2023-12')
  })
})
