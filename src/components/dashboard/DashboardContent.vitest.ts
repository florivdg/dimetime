import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import type { DashboardStats, InstallmentsStats } from '@/lib/dashboard'

const stub = defineComponent({ setup: () => () => h('div') })
vi.mock('./DashboardMonthlyChart.vue', () => ({ default: stub }))

const DashboardContent = (await import('./DashboardContent.vue')).default

const noInstallments: InstallmentsStats = {
  monthlyLoad: 0,
  totalRemainingSum: 0,
  top: [],
}

function statsWith(installments: InstallmentsStats): DashboardStats {
  return {
    currentPlan: {
      id: 'p1',
      name: 'August 2026',
      date: '2026-08-01',
      isUpcoming: false,
      income: 0,
      expense: 0,
      net: 0,
    },
    pendingTransactions: { count: 0, incomeTotal: 0, expenseTotal: 0 },
    topCategories: [],
    installments,
  }
}

describe('DashboardContent.vue', () => {
  it('hides the installments card without running plans', () => {
    const wrapper = mount(DashboardContent, {
      props: { stats: statsWith(noInstallments) },
    })
    expect(wrapper.text()).not.toContain('Laufende Ratenzahlungen')
    expect(wrapper.get('.grid').classes()).toContain('md:grid-cols-3')
  })

  it('shows the installments card and widens the grid when rates run', () => {
    const wrapper = mount(DashboardContent, {
      props: {
        stats: statsWith({
          monthlyLoad: 7990,
          totalRemainingSum: 55930,
          top: [
            {
              id: 'ip-1',
              name: 'Sofa Ratenkauf',
              amount: 7990,
              paidCount: 5,
              totalInstallments: 12,
            },
          ],
        }),
      },
    })
    expect(wrapper.text()).toContain('Laufende Ratenzahlungen')
    expect(wrapper.get('.grid').classes()).toContain('lg:grid-cols-4')
  })
})
