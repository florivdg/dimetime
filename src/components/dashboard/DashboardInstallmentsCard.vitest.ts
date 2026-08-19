import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { DashboardInstallment } from '@/lib/dashboard'

const DashboardInstallmentsCard = (
  await import('./DashboardInstallmentsCard.vue')
).default

const sofa: DashboardInstallment = {
  id: 'ip-1',
  name: 'Sofa Ratenkauf',
  amount: 7990,
  paidCount: 5,
  totalInstallments: 12,
}

function mountCard(installments: DashboardInstallment[] = [sofa]) {
  return mount(DashboardInstallmentsCard, {
    props: {
      monthlyLoad: 27090,
      totalRemainingSum: 356130,
      installments,
    },
  })
}

describe('DashboardInstallmentsCard.vue', () => {
  it('renders the aggregates as formatted amounts', () => {
    const text = mountCard().text().replace(/ /g, ' ')
    expect(text).toContain('270,90 €')
    expect(text).toContain('3.561,30 €')
  })

  it('lists each installment with its rate progress', () => {
    const wrapper = mountCard()
    const text = wrapper.text().replace(/ /g, ' ')
    expect(text).toContain('Sofa Ratenkauf')
    expect(text).toContain('79,90 €')
    expect(text).toContain('Rate 5 von 12')
    expect(wrapper.find('[data-progress]').attributes('data-progress')).toBe(
      '42',
    )
  })

  it('links to the installments page', () => {
    expect(mountCard().find('a').attributes('href')).toBe('/installments')
  })

  it('renders the aggregates without any listed installment', () => {
    const wrapper = mountCard([])
    expect(wrapper.text().replace(/ /g, ' ')).toContain('270,90 €')
    expect(wrapper.find('[data-progress]').exists()).toBe(false)
  })

  it('shows no progress for a plan without installments', () => {
    const wrapper = mountCard([{ ...sofa, totalInstallments: 0 }])
    expect(wrapper.find('[data-progress]').attributes('data-progress')).toBe(
      '0',
    )
  })
})
