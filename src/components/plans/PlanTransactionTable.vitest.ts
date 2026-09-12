import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { sampleTransactionRow } from '@/../test/fixtures'
import type { TransactionWithCategory } from '@/lib/transactions'

const stub = defineComponent({ setup: () => () => h('span') })
vi.mock('@/components/plans/BudgetUtilizationBadge.vue', () => ({
  default: stub,
}))

const PlanTransactionTable = (await import('./PlanTransactionTable.vue'))
  .default

const sampleTx = sampleTransactionRow

describe('PlanTransactionTable.vue', () => {
  it('renders an actionable empty state and emits fillFromPresets', async () => {
    const wrapper = mount(PlanTransactionTable, {
      props: {
        transactions: [],
        isLoading: false,
        searchQuery: '',
        sortBy: 'dueDate',
        sortDir: 'asc',
        isArchived: false,
        budgetSpending: {},
        planDate: '2026-03-01',
      },
    })
    expect(wrapper.text()).toContain('Keine Transaktionen vorhanden.')
    const fillButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Mit Vorlagen füllen'))
    expect(fillButton).toBeDefined()
    await fillButton!.trigger('click')
    expect(wrapper.emitted('fillFromPresets')).toHaveLength(1)
  })

  it('renders rows for given transactions', () => {
    const wrapper = mount(PlanTransactionTable, {
      props: {
        transactions: [sampleTx],
        isLoading: false,
        searchQuery: '',
        sortBy: 'dueDate',
        sortDir: 'asc',
        isArchived: false,
        budgetSpending: {},
        planDate: '2026-03-01',
      },
    })
    expect(wrapper.text()).toContain('Rent')
  })

  it('hides the move action for installment rows', () => {
    const menuText = (transaction: TransactionWithCategory) =>
      mount(PlanTransactionTable, {
        props: {
          transactions: [transaction],
          isLoading: false,
          searchQuery: '',
          sortBy: 'dueDate',
          sortDir: 'asc',
          isArchived: false,
          budgetSpending: {},
          planDate: '2026-03-01',
        },
      }).text()

    expect(menuText(sampleTx)).toContain('Verschieben')
    // Raten-Posten sind an ihren Plan gebunden
    expect(
      menuText({
        ...sampleTx,
        installmentId: 'ip-1',
        installmentName: 'Waschmaschine',
        ratePosition: 3,
        rateTotal: 12,
      }),
    ).not.toContain('Verschieben')
  })

  it('shows the installment badge for linked rows', () => {
    const wrapper = mount(PlanTransactionTable, {
      props: {
        transactions: [
          {
            ...sampleTx,
            installmentId: 'ip-1',
            installmentName: 'Waschmaschine',
            ratePosition: 3,
            rateTotal: 12,
          },
        ],
        isLoading: false,
        searchQuery: '',
        sortBy: 'dueDate',
        sortDir: 'asc',
        isArchived: false,
        budgetSpending: {},
        planDate: '2026-03-01',
      },
    })
    expect(wrapper.text()).toContain('Rate 3/12')
  })
})
