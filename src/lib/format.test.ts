import { describe, expect, it } from 'bun:test'
import {
  formatAmount,
  formatDate,
  formatDateTime,
  formatRecurrence,
  getIsoWeek,
  getMonthPacing,
  getMonthWeekSegments,
  getPlanDisplayName,
  truncateText,
} from './format'

/** Normalize whitespace (Intl may produce non-breaking spaces U+00A0) */
function norm(s: string): string {
  return s.replace(/\u00a0/g, ' ')
}

describe('formatAmount', () => {
  it('formats positive cents', () => {
    expect(norm(formatAmount(1234))).toContain('12,34')
    expect(norm(formatAmount(1234))).toContain('€')
  })

  it('formats negative cents', () => {
    const result = norm(formatAmount(-5000))
    expect(result).toContain('50,00')
    expect(result).toContain('€')
  })

  it('formats zero', () => {
    const result = norm(formatAmount(0))
    expect(result).toContain('0,00')
  })

  it('formats amounts with thousand separators', () => {
    const result = norm(formatAmount(123456))
    expect(result).toContain('1.234,56')
  })
})

describe('formatDate', () => {
  it('formats ISO date string', () => {
    expect(formatDate('2024-03-15')).toBe('15.03.2024')
  })

  it('formats Date object', () => {
    expect(formatDate(new Date(2024, 5, 1))).toBe('01.06.2024')
  })

  it('interprets timestamp strings in the same local timezone as Date objects', () => {
    const timestamp = '2024-06-01T00:00:00Z'
    const expected = new Intl.DateTimeFormat('de-DE', {
      dateStyle: 'medium',
    }).format(new Date(timestamp))
    expect(formatDate(timestamp)).toBe(expected)
  })

  it('respects style parameter', () => {
    const short = formatDate('2024-03-15', 'short')
    const long = formatDate('2024-03-15', 'long')
    expect(long.length).toBeGreaterThan(short.length)
  })
})

describe('getPlanDisplayName', () => {
  it('returns name when present', () => {
    expect(getPlanDisplayName('Mein Plan', '2024-03-01')).toBe('Mein Plan')
  })

  it('returns month/year from date when name is null', () => {
    expect(getPlanDisplayName(null, '2024-03-01')).toBe('März 2024')
  })

  it('returns month/year from date when name is empty', () => {
    expect(getPlanDisplayName('', '2024-01-01')).toBe('Januar 2024')
  })

  it('returns dash when both are null', () => {
    expect(getPlanDisplayName(null, null)).toBe('-')
  })
})

describe('formatDateTime', () => {
  it('combines date + time with defaults', () => {
    const result = formatDateTime('2024-03-15T14:30:00Z')
    expect(result).toContain('2024')
    // hour digits present (depending on locale rendering)
    expect(result).toMatch(/\d{1,2}/)
  })

  it('honors custom dateStyle and timeStyle', () => {
    const short = formatDateTime('2024-03-15T14:30:00Z', 'short', 'short')
    const long = formatDateTime('2024-03-15T14:30:00Z', 'long', 'long')
    expect(long.length).toBeGreaterThan(short.length)
  })
})

describe('truncateText', () => {
  it('returns empty string for null', () => {
    expect(truncateText(null)).toBe('')
  })

  it('returns text unchanged when within limit', () => {
    expect(truncateText('short', 10)).toBe('short')
  })

  it('truncates and appends ellipsis when over limit', () => {
    expect(truncateText('abcdefghij', 5)).toBe('abcde…')
  })

  it('uses default maxLength of 100', () => {
    const text = 'a'.repeat(150)
    const result = truncateText(text)
    expect(result.length).toBe(101)
    expect(result.endsWith('…')).toBe(true)
  })
})

describe('getMonthPacing', () => {
  it('reports 0% elapsed when plan month is in the future', () => {
    const result = getMonthPacing('2030-12-01', new Date('2026-05-15'))
    expect(result.isCurrent).toBe(false)
    expect(result.daysElapsed).toBe(0)
    expect(result.totalDays).toBe(31)
    expect(result.percentElapsed).toBe(0)
  })

  it('reports 100% elapsed when plan month is in the past', () => {
    const result = getMonthPacing('2020-02-01', new Date('2026-05-15'))
    expect(result.isCurrent).toBe(false)
    expect(result.daysElapsed).toBe(29) // 2020 is a leap year
    expect(result.totalDays).toBe(29)
    expect(result.percentElapsed).toBe(100)
  })

  it('reports today.getDate() elapsed when plan month is current', () => {
    const today = new Date(2026, 4, 10) // May 10, 2026 (local time)
    const result = getMonthPacing('2026-05-01', today)
    expect(result.isCurrent).toBe(true)
    expect(result.daysElapsed).toBe(10)
    expect(result.totalDays).toBe(31)
  })

  it('treats past year as fully elapsed', () => {
    const result = getMonthPacing('2020-06-15', new Date('2026-01-01'))
    expect(result.isCurrent).toBe(false)
    expect(result.daysElapsed).toBe(30)
  })
})

describe('getIsoWeek', () => {
  it('returns week 1 for January 1, 2026 (a Thursday)', () => {
    expect(getIsoWeek(new Date(2026, 0, 1))).toBe(1)
  })

  it('returns week 36 for September 1, 2026', () => {
    expect(getIsoWeek(new Date(2026, 8, 1))).toBe(36)
  })

  it('returns week 40 for September 28, 2026', () => {
    expect(getIsoWeek(new Date(2026, 8, 28))).toBe(40)
  })

  it('returns week 53 for January 3, 2027 (belongs to the previous ISO year)', () => {
    expect(getIsoWeek(new Date(2027, 0, 3))).toBe(53)
  })
})

describe('getMonthWeekSegments', () => {
  /** A reference date that is guaranteed to fall outside every tested month */
  const NEVER_CURRENT = new Date(2030, 0, 1)

  /** Compact [startDay, endDay] view of the segments */
  function ranges(
    planDate: string,
    today: Date = NEVER_CURRENT,
  ): [number, number][] {
    return getMonthWeekSegments(planDate, today).map((s) => [
      s.startDay,
      s.endDay,
    ])
  }

  it('splits a month starting mid-week (September 2026, 1st is a Tuesday)', () => {
    expect(ranges('2026-09-01')).toEqual([
      [1, 6],
      [7, 13],
      [14, 20],
      [21, 27],
      [28, 30],
    ])
  })

  it('assigns the ISO weeks of September 2026', () => {
    const segments = getMonthWeekSegments('2026-09-01', NEVER_CURRENT)
    expect(segments.map((s) => s.isoWeek)).toEqual([36, 37, 38, 39, 40])
  })

  it('splits a month starting on a Sunday (February 2026)', () => {
    expect(ranges('2026-02-01')).toEqual([
      [1, 1],
      [2, 8],
      [9, 15],
      [16, 22],
      [23, 28],
    ])
  })

  it('splits a month starting on a Monday (June 2026)', () => {
    expect(ranges('2026-06-01')).toEqual([
      [1, 7],
      [8, 14],
      [15, 21],
      [22, 28],
      [29, 30],
    ])
  })

  it('splits a month starting on a Thursday (January 2026)', () => {
    expect(ranges('2026-01-01')).toEqual([
      [1, 4],
      [5, 11],
      [12, 18],
      [19, 25],
      [26, 31],
    ])
  })

  it('uses the month of the plan date, not just the first of the month', () => {
    expect(ranges('2026-09-17')).toEqual(ranges('2026-09-01'))
  })

  it('covers every day of the month exactly once', () => {
    const segments = getMonthWeekSegments('2026-09-01', NEVER_CURRENT)
    const totalDays = segments.reduce(
      (sum, s) => sum + (s.endDay - s.startDay + 1),
      0,
    )
    expect(totalDays).toBe(30)
    segments.forEach((s, i) => {
      if (i > 0) expect(s.startDay).toBe(segments[i - 1]!.endDay + 1)
    })
  })

  it('produces percentages that span the full bar', () => {
    const segments = getMonthWeekSegments('2026-02-01', NEVER_CURRENT)
    const totalWidth = segments.reduce((sum, s) => sum + s.widthPercent, 0)
    expect(totalWidth).toBeCloseTo(100, 10)
    expect(segments[0]!.startPercent).toBe(0)
    const last = segments[segments.length - 1]!
    expect(last.startPercent + last.widthPercent).toBeCloseTo(100, 10)
    expect(segments[1]!.startPercent).toBeCloseTo((1 / 28) * 100, 10)
  })

  it('marks exactly one segment as current when today is in the month', () => {
    const segments = getMonthWeekSegments('2026-09-01', new Date(2026, 8, 17))
    const current = segments.filter((s) => s.isCurrent)
    expect(current.length).toBe(1)
    expect(current[0]!.startDay).toBe(14)
    expect(current[0]!.endDay).toBe(20)
  })

  it('marks no segment as current for another month', () => {
    const segments = getMonthWeekSegments('2026-09-01', new Date(2026, 9, 17))
    expect(segments.some((s) => s.isCurrent)).toBe(false)
  })

  it('marks no segment as current for the same month in another year', () => {
    const segments = getMonthWeekSegments('2026-09-01', new Date(2027, 8, 17))
    expect(segments.some((s) => s.isCurrent)).toBe(false)
  })

  it('assigns week 1 to the last days of December 2024', () => {
    expect(ranges('2024-12-01')).toEqual([
      [1, 1],
      [2, 8],
      [9, 15],
      [16, 22],
      [23, 29],
      [30, 31],
    ])
    const segments = getMonthWeekSegments('2024-12-01', NEVER_CURRENT)
    expect(segments.map((s) => s.isoWeek)).toEqual([48, 49, 50, 51, 52, 1])
  })

  it('assigns week 53 to the first days of January 2027', () => {
    expect(ranges('2027-01-01')).toEqual([
      [1, 3],
      [4, 10],
      [11, 17],
      [18, 24],
      [25, 31],
    ])
    const segments = getMonthWeekSegments('2027-01-01', NEVER_CURRENT)
    expect(segments.map((s) => s.isoWeek)).toEqual([53, 1, 2, 3, 4])
  })
})

describe('formatRecurrence', () => {
  it('formats all German recurrence types', () => {
    expect(formatRecurrence('einmalig')).toBe('Einmalig')
    expect(formatRecurrence('monatlich')).toBe('Monatlich')
    expect(formatRecurrence('vierteljährlich')).toBe('Vierteljährlich')
    expect(formatRecurrence('halbjährlich')).toBe('Halbjährlich')
    expect(formatRecurrence('jährlich')).toBe('Jährlich')
  })

  it('returns input as fallback for unknown values', () => {
    expect(formatRecurrence('weekly')).toBe('weekly')
  })
})
