import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import {
  shadcnButton,
  shadcnDropdownMenu,
  shadcnTooltip,
} from '@/../test/component-mocks'

vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/components/ui/button', () => shadcnButton)
vi.mock('@/components/ui/dropdown-menu', () => shadcnDropdownMenu)
vi.mock('@/components/ui/tooltip', () => shadcnTooltip)

const stub = defineComponent({ setup: () => () => h('div') })
vi.mock('./PlanTransactionFilters.vue', () => ({ default: stub }))
vi.mock('./PlanTransactionTable.vue', () => ({ default: stub }))
vi.mock('@/components/transactions/TransactionEditDialog.vue', () => ({
  default: stub,
}))
vi.mock('@/components/transactions/TransactionCreateDialog.vue', () => ({
  default: stub,
}))
vi.mock('@/components/transactions/TransactionMoveDialog.vue', () => ({
  default: stub,
}))
vi.mock('@/components/presets/PresetCreateDialog.vue', () => ({
  default: stub,
}))
vi.mock('@/components/presets/FillFromPresetsDialog.vue', () => ({
  default: stub,
}))
vi.mock('@/components/transactions/CopyFromPlanDialog.vue', () => ({
  default: stub,
}))

const PlanDetailManager = (await import('./PlanDetailManager.vue')).default

const samplePlan = {
  id: 'plan-1',
  name: 'March 2026',
  date: '2026-03-01',
  notes: null,
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('PlanDetailManager.vue', () => {
  it('mounts with empty data', () => {
    const wrapper = mount(PlanDetailManager, {
      props: {
        plan: samplePlan,
        initialTransactions: [],
        initialBalance: { income: 0, expense: 0, net: 0 },
        categories: [],
      },
    })
    expect(wrapper.text()).toContain('March 2026')
  })

  it('shows balance summary cards', () => {
    const wrapper = mount(PlanDetailManager, {
      props: {
        plan: samplePlan,
        initialTransactions: [],
        initialBalance: { income: 1000, expense: 500, net: 500 },
        categories: [],
      },
    })
    expect(wrapper.text()).toContain('Einnahmen')
    expect(wrapper.text()).toContain('Ausgaben')
    expect(wrapper.text()).toContain('Saldo')
  })

  it('shows locked icon for archived plan', () => {
    const wrapper = mount(PlanDetailManager, {
      props: {
        plan: { ...samplePlan, isArchived: true },
        initialTransactions: [],
        initialBalance: { income: 0, expense: 0, net: 0 },
        categories: [],
      },
    })
    expect(wrapper.text()).toContain('Plan ist archiviert')
  })
})
