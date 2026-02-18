export interface ParsedMoney {
  amountCents: number
  currency: string
}

export function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null

  let raw: string
  if (typeof value === 'string') {
    raw = value
  } else if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    raw = String(value)
  } else {
    return null
  }

  const text = raw.replace(/\s+/g, ' ').trim()
  return text.length > 0 ? text : null
}

export function normalizeCurrency(
  currency: string | null | undefined,
  fallback = 'EUR',
): string {
  const normalized = normalizeText(currency)
  if (!normalized) return fallback
  if (normalized === '€') return 'EUR'
  return normalized.toUpperCase()
}

export function parseGermanDateToIso(value: string): string | null {
  const normalized = normalizeText(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!match) return null

  const [, dayRaw, monthRaw, year] = match
  const day = dayRaw.padStart(2, '0')
  const month = monthRaw.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseGermanMoney(
  value: string | null | undefined,
  fallbackCurrency = 'EUR',
): ParsedMoney | null {
  const normalized = normalizeText(value)
  if (!normalized) return null

  // Examples:
  // -20,67 €
  // +2.100,00 EUR
  // -140,47
  const moneyMatch = normalized.match(
    /^([+-])?\s*([\d.]+(?:,\d{1,2})?|\d+)(?:\s*(€|[A-Za-z]{3}))?$/,
  )

  if (!moneyMatch) return null

  const [, signRaw, numberRaw, currencyRaw] = moneyMatch
  const sign = signRaw === '-' ? -1 : 1
  const numericValue = Number(numberRaw.replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(numericValue)) return null

  return {
    amountCents: Math.round(numericValue * 100) * sign,
    currency: normalizeCurrency(currencyRaw, fallbackCurrency),
  }
}

export function extractCardLast4(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeText(value)
  if (!normalized) return null
  const digits = normalized.replace(/\D/g, '')
  if (digits.length < 4) return null
  return digits.slice(-4)
}

export function monthFromIsoDate(isoDate: string): string {
  return isoDate.slice(0, 7)
}
