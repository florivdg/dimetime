import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import {
  shadcnAlertDialog,
  shadcnButton,
  shadcnDropdownMenu,
  shadcnInput,
  shadcnInputGroup,
  shadcnSelect,
  shadcnTable,
  shadcnTooltip,
} from '@/../test/component-mocks'

vi.mock('@/components/ui/button', () => shadcnButton)
vi.mock('@/components/ui/input', () => shadcnInput)
vi.mock('@/components/ui/select', () => shadcnSelect)
vi.mock('@/components/ui/table', () => shadcnTable)
vi.mock('@/components/ui/alert-dialog', () => shadcnAlertDialog)
vi.mock('@/components/ui/dropdown-menu', () => shadcnDropdownMenu)
vi.mock('@/components/ui/tooltip', () => shadcnTooltip)
vi.mock('@/components/ui/input-group', () => shadcnInputGroup)

const budgetBadgeStub = defineComponent({ setup: () => () => h('span') })
vi.mock('@/components/plans/BudgetUtilizationBadge.vue', () => ({
  default: budgetBadgeStub,
}))

const TransactionTable = (await import('./TransactionTable.vue')).default

const sampleTx = {
  id: 'tx-1',
  name: 'Rent',
  note: null,
  type: 'expense' as const,
  dueDate: '2026-03-01',
  amount: 100000,
  isDone: false,
  isBudget: false,
  completedAt: null,
  planId: 'plan-1',
  userId: null,
  categoryId: null,
  categoryName: null,
  categoryColor: null,
  planName: 'March',
  planDate: '2026-03-01',
  planIsArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}

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
