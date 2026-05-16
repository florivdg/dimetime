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
    setup: () => () => h('input', { type: 'checkbox' }),
  }),
}))

const PresetEditDialog = (await import('./PresetEditDialog.vue')).default

const samplePreset = {
  id: 'p-1',
  name: 'Rent',
  note: null,
  type: 'expense' as const,
  amount: 100000,
  recurrence: 'monatlich' as const,
  startMonth: '2026-01',
  endDate: null,
  categoryId: null,
  dayOfMonth: null,
  isBudget: false,
  userId: 'u-1',
  lastUsedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  categoryName: null,
  categoryColor: null,
}

describe('PresetEditDialog.vue', () => {
  it('mounts with a preset', () => {
    const wrapper = mount(PresetEditDialog, {
      props: { open: true, preset: samplePreset, categories: [] },
    })
    expect(wrapper.html()).toBeTruthy()
  })

  it('mounts without preset (null)', () => {
    const wrapper = mount(PresetEditDialog, {
      props: { open: false, preset: null, categories: [] },
    })
    expect(wrapper.html()).toBeTruthy()
  })
})
