import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { sampleTransactionRow } from '@/../test/fixtures'

const budgetBadgeStub = defineComponent({ setup: () => () => h('span') })
vi.mock('@/components/plans/BudgetUtilizationBadge.vue', () => ({
  default: budgetBadgeStub,
}))

const TransactionTable = (await import('./TransactionTable.vue')).default

const sampleTx = sampleTransactionRow

describe('TransactionTable.vue', () => {
  it('renders empty state when no transactions and no search', () => {
    const wrapper = mount(TransactionTable, {
      props: {
        transactions: [],
        isLoading: false,
        searchQuery: '',
        sortBy: 'dueDate',
        sortDir: 'asc',
        categories: [],
      },
    })
    expect(wrapper.text()).toContain('Keine Transaktionen vorhanden')
  })

  it('renders search empty state when query has no results', () => {
    const wrapper = mount(TransactionTable, {
      props: {
        transactions: [],
        isLoading: false,
        searchQuery: 'xyz',
        sortBy: 'dueDate',
        sortDir: 'asc',
        categories: [],
      },
    })
    expect(wrapper.text()).toContain('Keine Transaktionen gefunden')
  })

  it('renders loading state', () => {
    const wrapper = mount(TransactionTable, {
      props: {
        transactions: [],
        isLoading: true,
        searchQuery: '',
        sortBy: 'dueDate',
        sortDir: 'asc',
        categories: [],
      },
    })
    expect(wrapper.find('.animate-spin').exists()).toBe(true)
  })

  it('renders transaction rows', () => {
    const wrapper = mount(TransactionTable, {
      props: {
        transactions: [sampleTx],
        isLoading: false,
        searchQuery: '',
        sortBy: 'dueDate',
        sortDir: 'asc',
        categories: [],
      },
    })
    expect(wrapper.text()).toContain('Rent')
  })

  it('emits sort event when header sort button is clicked', async () => {
    const wrapper = mount(TransactionTable, {
      props: {
        transactions: [sampleTx],
        isLoading: false,
        searchQuery: '',
        sortBy: 'dueDate',
        sortDir: 'asc',
        categories: [],
      },
    })
    const headerButtons = wrapper.findAll('th button')
    expect(headerButtons.length).toBeGreaterThan(0)
    await headerButtons[0].trigger('click')
    expect(wrapper.emitted('sort')).toBeTruthy()
  })
})
