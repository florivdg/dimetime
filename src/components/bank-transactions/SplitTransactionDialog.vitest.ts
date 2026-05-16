import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import {
  shadcnButton,
  shadcnDialog,
  shadcnInput,
} from '@/../test/component-mocks'

vi.mock('@/components/ui/button', () => shadcnButton)
vi.mock('@/components/ui/input', () => shadcnInput)
vi.mock('@/components/ui/dialog', () => shadcnDialog)
vi.mock('@/components/ui/label', () => ({
  Label: defineComponent({
    setup(_, { slots }) {
      return () => h('label', {}, slots.default?.())
    },
  }),
}))
vi.mock('@/components/ui/progress', () => ({
  Progress: defineComponent({
    props: ['modelValue'],
    setup: () => () => h('div'),
  }),
}))
vi.mock('@/components/ui/separator', () => ({
  Separator: defineComponent({ setup: () => () => h('hr') }),
}))

const SplitTransactionDialog = (await import('./SplitTransactionDialog.vue'))
  .default

const baseTx = {
  id: 'bt-1',
  rowType: 'transaction' as const,
  parentId: null,
  bookingDate: '2026-03-01',
  counterparty: null,
  description: 'Test',
  amountCents: -10000,
  label: null,
  sourceName: null,
  status: 'booked',
  planId: null,
  planDate: null,
  planName: null,
  budgetId: null,
  budgetName: null,
  isArchived: false,
  note: null,
  purpose: null,
  isSplit: false,
  createdAt: new Date(),
  sortOrder: 0,
}

describe('SplitTransactionDialog.vue', () => {
  it('mounts with a transaction', () => {
    const wrapper = mount(SplitTransactionDialog, {
      props: { transaction: baseTx, open: true },
    })
    expect(wrapper.html()).toBeTruthy()
  })

  it('mounts with null transaction', () => {
    const wrapper = mount(SplitTransactionDialog, {
      props: { transaction: null, open: false },
    })
    expect(wrapper.html()).toBeTruthy()
  })
})
