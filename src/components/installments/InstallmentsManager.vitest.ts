import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import type { InstallmentOverview } from '@/lib/installments'

vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const stub = defineComponent({ setup: () => () => h('div') })
vi.mock('./InstallmentTimelineChart.vue', () => ({ default: stub }))
vi.mock('./InstallmentTable.vue', () => ({ default: stub }))
vi.mock('./InstallmentFormDialog.vue', () => ({ default: stub }))

const InstallmentsManager = (await import('./InstallmentsManager.vue')).default

const emptyOverview: InstallmentOverview = {
  installments: [],
  aggregates: { currentMonthlyLoad: 0, totalRemainingSum: 0 },
  timeline: [],
}

describe('InstallmentsManager.vue', () => {
  it('mounts with an empty overview', () => {
    const wrapper = mount(InstallmentsManager, {
      props: { initialOverview: emptyOverview, categories: [] },
    })
    expect(wrapper.text()).toContain('Aktuelle Monatsbelastung')
    expect(wrapper.text()).toContain('Gesamt-Restschuld')
  })

  it('renders the aggregates as formatted amounts', () => {
    const wrapper = mount(InstallmentsManager, {
      props: {
        initialOverview: {
          ...emptyOverview,
          aggregates: { currentMonthlyLoad: 5000, totalRemainingSum: 45000 },
        },
        categories: [],
      },
    })
    const text = wrapper.text().replace(/ /g, ' ')
    expect(text).toContain('50,00 €')
    expect(text).toContain('450,00 €')
  })
})
