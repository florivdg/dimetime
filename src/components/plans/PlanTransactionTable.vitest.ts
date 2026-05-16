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
vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: defineComponent({
    setup: () => () => h('input', { type: 'checkbox' }),
  }),
}))

const stub = defineComponent({ setup: () => () => h('span') })
vi.mock('@/components/plans/BudgetUtilizationBadge.vue', () => ({
  default: stub,
}))

const PlanTransactionTable = (await import('./PlanTransactionTable.vue'))
  .default

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

describe('PlanTransactionTable.vue', () => {
  it('renders empty state when no transactions', () => {
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
    expect(wrapper.html()).toBeTruthy()
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
})
