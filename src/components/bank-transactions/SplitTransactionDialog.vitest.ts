import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

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

function finishButton(wrapper: ReturnType<typeof mount>) {
  const button = wrapper
    .findAll('button')
    .find((candidate) => candidate.text().includes('Fertig'))
  if (!button) throw new Error('Fertig button not found')
  return button
}

describe('SplitTransactionDialog.vue', () => {
  it('emits a signed two-way split including the calculated remainder', async () => {
    const wrapper = mount(SplitTransactionDialog, {
      props: { transaction: baseTx, open: true },
    })

    await wrapper.get('#split-amount').setValue('60,00')
    await wrapper.get('#split-label').setValue('Lebensmittel')
    await finishButton(wrapper).trigger('click')

    expect(wrapper.emitted('split')).toEqual([
      [[{ amountCents: -6000, label: 'Lebensmittel' }, { amountCents: -4000 }]],
    ])
  })

  it('rejects a one-part split equal to the original transaction', async () => {
    const wrapper = mount(SplitTransactionDialog, {
      props: { transaction: baseTx, open: true },
    })

    await wrapper.get('#split-amount').setValue('100')
    const finish = finishButton(wrapper)

    expect(finish.attributes('disabled')).toBe('')
    await finish.trigger('click')
    expect(wrapper.emitted('split')).toBeUndefined()
  })
})
