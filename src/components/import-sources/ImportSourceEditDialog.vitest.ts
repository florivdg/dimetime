import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import {
  shadcnButton,
  shadcnDialog,
  shadcnForm,
  shadcnInput,
  shadcnSelect,
} from '@/../test/component-mocks'

vi.mock('@/components/ui/button', () => shadcnButton)
vi.mock('@/components/ui/input', () => shadcnInput)
vi.mock('@/components/ui/dialog', () => shadcnDialog)
vi.mock('@/components/ui/form', () => shadcnForm)
vi.mock('@/components/ui/select', () => shadcnSelect)
vi.mock('@/components/ui/label', () => ({
  Label: defineComponent({
    setup(_, { slots }) {
      return () => h('label', {}, slots.default?.())
    },
  }),
}))
vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: defineComponent({
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup: () => () => h('input', { type: 'checkbox' }),
  }),
}))

const ImportSourceEditDialog = (await import('./ImportSourceEditDialog.vue'))
  .default

describe('ImportSourceEditDialog.vue', () => {
  it('mounts in create mode (no source)', () => {
    const wrapper = mount(ImportSourceEditDialog, {
      props: { open: true, source: null, importTypes: [] },
    })
    expect(wrapper.html()).toBeTruthy()
  })

  it('mounts in edit mode with a source', () => {
    const wrapper = mount(ImportSourceEditDialog, {
      props: {
        open: true,
        importTypes: [],
        source: {
          id: 'src-1',
          name: 'ING Main',
          preset: 'ing_csv_v1',
          sourceKind: 'bank_account',
          bankName: null,
          accountLabel: null,
          accountIdentifier: null,
          defaultPlanAssignment: 'auto_month',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    })
    expect(wrapper.html()).toBeTruthy()
  })
})
