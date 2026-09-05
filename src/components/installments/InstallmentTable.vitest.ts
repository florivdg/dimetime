import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { InstallmentPlanWithStats } from '@/lib/installments'

const InstallmentTable = (await import('./InstallmentTable.vue')).default

const running: InstallmentPlanWithStats = {
  id: 'ip-1',
  name: 'Waschmaschine',
  note: null,
  amount: 5000,
  finalAmount: null,
  totalInstallments: 12,
  prepaidInstallments: 2,
  startMonth: '2026-03',
  dayOfMonth: null,
  categoryId: null,
  userId: 'u1',
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  categoryName: null,
  categoryColor: null,
  paidCount: 3,
  openLinkedCount: 1,
  remainingCount: 9,
  remainingSum: 45000,
  projectedEndMonth: '2027-02',
}

describe('InstallmentTable.vue', () => {
  it('renders the empty state without installments', () => {
    const wrapper = mount(InstallmentTable, { props: { installments: [] } })
    expect(wrapper.text()).toContain('Keine Ratenzahlungen vorhanden.')
  })

  it('renders name, counter and projected end month', () => {
    const wrapper = mount(InstallmentTable, {
      props: { installments: [running] },
    })
    const text = wrapper.text()
    expect(text).toContain('Waschmaschine')
    expect(text).toContain('3 von 12 Raten bezahlt')
    expect(text).toContain('02/2027')
  })

  it('renders the counter for an untouched installment plan', () => {
    const wrapper = mount(InstallmentTable, {
      props: {
        installments: [{ ...running, prepaidInstallments: 0, paidCount: 0 }],
      },
    })
    expect(wrapper.text()).toContain('0 von 12 Raten bezahlt')
  })

  it('marks completed installments as "Abgelöst"', () => {
    const wrapper = mount(InstallmentTable, {
      props: {
        installments: [
          { ...running, completedAt: new Date(), projectedEndMonth: null },
        ],
      },
    })
    expect(wrapper.text()).toContain('Abgelöst')
  })
})
