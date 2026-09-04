import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { formatAmount, formatWholeEuros } from '@/lib/format'

const BudgetUtilizationBadge = (await import('./BudgetUtilizationBadge.vue'))
  .default

/** Frozen "today": 12. March 2026 (day 12 of 31) */
const NOW = new Date(2026, 2, 12, 10, 0, 0)
const CURRENT_MONTH = '2026-03-01'
const PAST_MONTH = '2026-01-01'
const FUTURE_MONTH = '2026-05-01'

/** Soll heute for a 1.000 € budget on day 12 of 31 */
const BUDGET = 100_000
const EXPECTED_SO_FAR = Math.round((BUDGET * 12) / 31) // 38710

function mountBadge(props: {
  budgetedCents: number
  spentCents: number
  planDate?: string | null
}) {
  return mount(BudgetUtilizationBadge, { props })
}

/** Classes of the tooltip bar fill, addressed via its `data-testid` anchor */
function barClasses(wrapper: VueWrapper): string[] {
  const bar = wrapper.find('[data-testid="budget-bar-fill"]')
  return bar.exists() ? bar.classes() : []
}

/** Inline style of the tooltip bar fill (carries the capped width) */
function barWidth(wrapper: VueWrapper): string {
  return (
    wrapper.find('[data-testid="budget-bar-fill"]').attributes('style') ?? ''
  )
}

/** The today marker only exists inside the running month */
function hasTodayMarker(wrapper: VueWrapper): boolean {
  return wrapper.find('[data-testid="today-marker"]').exists()
}

/** Week ticks let the tooltip surface shine through the bar fill */
function weekTickCount(wrapper: VueWrapper): number {
  return wrapper.findAll('[data-testid="week-tick"]').length
}

/** Labels of the three-column metric grid, in render order */
function metricLabels(wrapper: VueWrapper): string[] {
  return wrapper.findAll('[data-testid="metric-label"]').map((el) => el.text())
}

describe('BudgetUtilizationBadge.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the trigger with spent and budgeted amount', () => {
    const wrapper = mountBadge({
      budgetedCents: BUDGET,
      spentCents: 38_000,
      planDate: CURRENT_MONTH,
    })
    expect(wrapper.text()).toContain(
      `${formatAmount(38_000)} / ${formatAmount(BUDGET)}`,
    )
  })

  it('marks a current month within pace as on track', () => {
    const wrapper = mountBadge({
      budgetedCents: BUDGET,
      spentCents: 38_000, // 710 cents below Soll, inside the 1 % tolerance
      planDate: CURRENT_MONTH,
    })

    expect(wrapper.text()).toContain('Im Tempo')
    expect(barClasses(wrapper)).toContain('bg-lime-400')
    expect(barClasses(wrapper)).toContain('dark:bg-lime-600')
    expect(hasTodayMarker(wrapper)).toBe(true)
    expect(wrapper.text()).toContain('März 2026')
    expect(wrapper.text()).toContain('Tag 12 von 31')
    expect(weekTickCount(wrapper)).toBeGreaterThan(0)
    expect(metricLabels(wrapper)).toEqual([
      'Ausgegeben',
      'Soll heute',
      'Pro Tag noch',
    ])
  })

  it('marks a current month above pace but inside budget as warning', () => {
    const spentCents = 60_000
    const wrapper = mountBadge({
      budgetedCents: BUDGET,
      spentCents,
      planDate: CURRENT_MONTH,
    })

    expect(wrapper.text()).toContain(
      `${formatAmount(spentCents - EXPECTED_SO_FAR)} über Tempo`,
    )
    expect(barClasses(wrapper)).toContain('bg-amber-400')
    expect(barClasses(wrapper)).toContain('dark:bg-amber-600')
    expect(hasTodayMarker(wrapper)).toBe(true)
    // Soll heute gehört zu den Kennzahlen des laufenden Monats
    expect(wrapper.text()).toContain('Soll heute')
    expect(wrapper.text()).toContain(formatAmount(EXPECTED_SO_FAR))
  })

  it('marks spending above the budget as critical', () => {
    const wrapper = mountBadge({
      budgetedCents: BUDGET,
      spentCents: 120_000,
      planDate: CURRENT_MONTH,
    })

    expect(wrapper.text()).toContain(`${formatAmount(20_000)} über Budget`)
    expect(barClasses(wrapper)).toContain('bg-rose-400')
    expect(barClasses(wrapper)).toContain('dark:bg-rose-600')
    // Hero nennt die Überschreitung, nicht den Rest
    expect(wrapper.text()).toContain('zu viel')
    expect(wrapper.text()).not.toContain('verbleibend von')
    // Die Füllung wird bei 100 % gekappt
    expect(barWidth(wrapper)).toContain('width: 100%')
  })

  it('stays neutral and skips the projection without any spending', () => {
    const wrapper = mountBadge({
      budgetedCents: BUDGET,
      spentCents: 0,
      planDate: CURRENT_MONTH,
    })

    expect(wrapper.text()).toContain('Noch keine Ausgaben')
    expect(barClasses(wrapper)).toContain('bg-background/35')
    expect(wrapper.text()).toContain('Tag 12 von 31')
    expect(wrapper.text()).not.toContain('In diesem Tempo')
  })

  it('drops marker and footer for a finished month', () => {
    const wrapper = mountBadge({
      budgetedCents: BUDGET,
      spentCents: 80_000,
      planDate: PAST_MONTH,
    })

    expect(hasTodayMarker(wrapper)).toBe(false)
    expect(wrapper.text()).not.toContain('der Zeit vergangen')
    expect(wrapper.text()).not.toContain('In diesem Tempo')

    // Kennzahlen in der Rückblick-Variante
    expect(metricLabels(wrapper)).toEqual([
      'Budget',
      'Ausgegeben',
      'Verbleibend',
    ])
    expect(wrapper.text()).toContain('Januar 2026')

    // Zeitachse bleibt, Tempo-Aussagen verschwinden
    expect(weekTickCount(wrapper)).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('KW')
    expect(wrapper.text()).toContain('Im Budget')
    expect(wrapper.text()).not.toContain('Im Tempo')
  })

  it('renders without a plan date', () => {
    const wrapper = mountBadge({
      budgetedCents: BUDGET,
      spentCents: 40_000,
      planDate: null,
    })

    expect(wrapper.html()).toBeTruthy()
    expect(wrapper.text()).not.toContain('KW')
    expect(wrapper.text()).not.toContain('der Zeit vergangen')
    expect(hasTodayMarker(wrapper)).toBe(false)
    expect(wrapper.text()).toContain(formatAmount(60_000))
    expect(wrapper.text()).toContain('Im Budget')
    expect(weekTickCount(wrapper)).toBe(0)
  })

  it('survives a zero budget without NaN or Infinity', () => {
    const cases = [
      { budgetedCents: 0, spentCents: 0, planDate: CURRENT_MONTH },
      { budgetedCents: 0, spentCents: 5_000, planDate: CURRENT_MONTH },
      { budgetedCents: 0, spentCents: 5_000, planDate: null },
    ]

    for (const props of cases) {
      const wrapper = mountBadge(props)
      const html = wrapper.html()
      expect(html).not.toContain('NaN')
      expect(html).not.toContain('Infinity')

      // Ohne Budget gibt es weder Tempo-Aussage noch Hochrechnung
      const text = wrapper.text()
      expect(text).not.toContain('In diesem Tempo')
      expect(text).not.toContain('Tempo')
    }

    expect(
      mountBadge({
        budgetedCents: 0,
        spentCents: 5_000,
        planDate: CURRENT_MONTH,
      }).text(),
    ).toContain(`${formatAmount(5_000)} über Budget`)
  })

  it('shows a future month without pacing statements', () => {
    const wrapper = mountBadge({
      budgetedCents: BUDGET,
      spentCents: 20_000,
      planDate: FUTURE_MONTH,
    })
    const text = wrapper.text()

    expect(hasTodayMarker(wrapper)).toBe(false)
    expect(text).not.toContain('der Zeit vergangen')
    expect(text).not.toContain('In diesem Tempo')
    expect(text).not.toContain('Im Tempo')

    expect(text).toContain('Im Budget')
    expect(text).toContain('Mai 2026')
    // KW 18 (1.–3. Mai) ist zu schmal für ein Label, KW 19 ist das erste
    expect(text).toContain('KW 19')
    expect(metricLabels(wrapper)).toEqual([
      'Budget',
      'Ausgegeben',
      'Verbleibend',
    ])
    expect(weekTickCount(wrapper)).toBeGreaterThan(0)
    expect(wrapper.html()).not.toContain('NaN')
    expect(wrapper.html()).not.toContain('Infinity')
  })

  it('states a projection exactly on budget without a zero delta', () => {
    // 38.710 Cent an Tag 12 ergeben eine Hochrechnung von 1.000,01 €
    const wrapper = mountBadge({
      budgetedCents: BUDGET,
      spentCents: EXPECTED_SO_FAR,
      planDate: CURRENT_MONTH,
    })
    const text = wrapper.text()

    expect(text).toContain('genau im Budget')
    expect(text).not.toContain(`${formatWholeEuros(0)} unter Budget`)
    expect(text).not.toContain(`${formatWholeEuros(0)} über Budget`)
    // Der Hochrechnungssatz nennt nie Nachkommastellen
    expect(text).not.toMatch(/endet der Monat bei [^—]*,\d\d/)
  })

  it('projects the month end in whole euros', () => {
    const wrapper = mountBadge({
      budgetedCents: BUDGET,
      spentCents: 60_000,
      planDate: CURRENT_MONTH,
    })
    const text = wrapper.text()

    expect(text).toContain(`endet der Monat bei ${formatWholeEuros(155000)}`)
    expect(text).toContain(`${formatWholeEuros(55000)} über Budget`)
  })
})
