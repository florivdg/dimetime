import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { shadcnButton, shadcnDialog } from '@/../test/component-mocks'

vi.mock('vue-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/components/ui/button', () => shadcnButton)
vi.mock('@/components/ui/dialog', () => ({
  ...shadcnDialog,
  DialogScrollContent: shadcnDialog.DialogContent,
}))
vi.mock('@/components/ui/stepper', () => ({
  Stepper: defineComponent({
    setup(_, { slots }) {
      return () => h('div', {}, slots.default?.())
    },
  }),
  StepperItem: defineComponent({
    setup(_, { slots }) {
      return () => h('div', {}, slots.default?.({ state: 'inactive' }))
    },
  }),
  StepperSeparator: defineComponent({ setup: () => () => h('div') }),
  StepperTrigger: defineComponent({
    setup(_, { slots }) {
      return () => h('div', {}, slots.default?.())
    },
  }),
}))

const stubStep = defineComponent({ setup: () => () => h('div', 'step') })
vi.mock('./ImportSourceStep.vue', () => ({ default: stubStep }))
vi.mock('./ImportFileStep.vue', () => ({ default: stubStep }))
vi.mock('./ImportPreviewStep.vue', () => ({ default: stubStep }))
vi.mock('./ImportResultStep.vue', () => ({ default: stubStep }))

const BankImportDialog = (await import('./BankImportDialog.vue')).default

describe('BankImportDialog.vue', () => {
  it('mounts and renders the heading', () => {
    const wrapper = mount(BankImportDialog, {
      props: { open: true, sources: [] },
    })
    expect(wrapper.text()).toContain('Kontoauszug importieren')
  })

  it('renders without sources', () => {
    const wrapper = mount(BankImportDialog, {
      props: { open: true, sources: [] },
    })
    expect(wrapper.html()).toBeTruthy()
  })
})
