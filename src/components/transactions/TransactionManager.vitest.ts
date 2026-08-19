import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { toast } from 'vue-sonner'

vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const tableStub = defineComponent({
  emits: ['updated', 'deleted', 'error', 'sort', 'saveAsPreset'],
  setup: () => () => h('div'),
})
vi.mock('./TransactionTable.vue', () => ({ default: tableStub }))
vi.mock('@/components/presets/PresetCreateDialog.vue', () => ({
  default: defineComponent({ setup: () => () => h('div') }),
}))
vi.mock('@/components/shared/PaginationControls.vue', () => ({
  default: defineComponent({ setup: () => () => h('div') }),
}))

const TransactionManager = (await import('./TransactionManager.vue')).default

function mountManager() {
  return mount(TransactionManager, {
    props: {
      initialTransactions: [],
      initialPagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
      categories: [],
      plans: [],
    },
  })
}

describe('TransactionManager.vue', () => {
  beforeEach(() => {
    vi.mocked(toast.info).mockClear()
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            transactions: [],
            pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
            budgetSpending: {},
          }),
      }),
    ) as never
  })

  it('shows the skip toast when a deleted row tombstoned an installment month', async () => {
    const wrapper = mountManager()
    wrapper
      .findComponent(tableStub)
      .vm.$emit('deleted', { installmentSkipped: true })
    await wrapper.vm.$nextTick()
    expect(toast.info).toHaveBeenCalledWith(
      'Rate wird in diesem Monat ausgesetzt.',
    )
  })

  it('stays silent when a regular transaction is deleted', async () => {
    const wrapper = mountManager()
    wrapper
      .findComponent(tableStub)
      .vm.$emit('deleted', { installmentSkipped: false })
    await wrapper.vm.$nextTick()
    expect(toast.info).not.toHaveBeenCalled()
  })
})
