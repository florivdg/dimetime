import { describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { nextTick, type DefineComponent } from 'vue'
import { Popover as PopoverComponent } from '@/components/ui/popover'
import { CommandItem as CommandItemComponent } from '@/components/ui/command'
import { Textarea as TextareaComponent } from '@/components/ui/textarea'
import { jsonResponse } from '@/../test/composable-helpers'
import NoteEditor from './NoteEditor.vue'
import PlanPicker from './PlanPicker.vue'
import BudgetPicker from './BudgetPicker.vue'

const Popover = PopoverComponent as unknown as DefineComponent<{
  open: boolean
}>
const CommandItem = CommandItemComponent as unknown as DefineComponent<{
  value: string
}>
const Textarea = TextareaComponent as unknown as DefineComponent<{
  modelValue: string
}>

// These tests exercise the editors' state and emitted values. Popup focus and
// positioning belong to reka-ui; render its slots without those browser effects.
const global = { renderStubDefaultSlot: true }

describe('NoteEditor', () => {
  it('saves a trimmed note for its transaction when the editor closes', async () => {
    const wrapper = shallowMount(NoteEditor, {
      props: { note: 'Old', transactionId: 'split' },
      global,
    })
    const popover = wrapper.getComponent(Popover)
    popover.vm.$emit('update:open', true)
    await nextTick()
    wrapper
      .getComponent(Textarea)
      .vm.$emit('update:modelValue', '  Receipt saved  ')
    await nextTick()
    expect(wrapper.emitted('update:note')).toBeUndefined()
    popover.vm.$emit('update:open', false)
    await nextTick()
    expect(wrapper.emitted('update:note')).toEqual([['split', 'Receipt saved']])
  })

  it('does not save unchanged content and converts whitespace-only notes to null', async () => {
    const wrapper = shallowMount(NoteEditor, {
      props: { note: 'Old', transactionId: 'transaction' },
      global,
    })
    const popover = wrapper.getComponent(Popover)
    popover.vm.$emit('update:open', true)
    await nextTick()
    wrapper.getComponent(Textarea).vm.$emit('update:modelValue', ' Old ')
    popover.vm.$emit('update:open', false)
    await nextTick()
    expect(wrapper.emitted('update:note')).toBeUndefined()
    popover.vm.$emit('update:open', true)
    await nextTick()
    wrapper.getComponent(Textarea).vm.$emit('update:modelValue', ' \n ')
    popover.vm.$emit('update:open', false)
    await nextTick()
    expect(wrapper.emitted('update:note')).toEqual([['transaction', null]])
  })

  it('uses updated saved notes on reopen while preserving an open draft', async () => {
    const wrapper = shallowMount(NoteEditor, {
      props: { note: 'Old', transactionId: 'transaction' },
      global,
    })
    await wrapper.setProps({ note: 'Server update' })
    expect(wrapper.getComponent(Textarea).props('modelValue')).toBe(
      'Server update',
    )
    wrapper.getComponent(Popover).vm.$emit('update:open', true)
    await nextTick()
    wrapper.getComponent(Textarea).vm.$emit('update:modelValue', 'Draft')
    await wrapper.setProps({ note: 'Another server update' })
    expect(wrapper.getComponent(Textarea).props('modelValue')).toBe('Draft')
  })
})

describe('PlanPicker', () => {
  it('clears a plan and suppresses duplicate selections', async () => {
    const wrapper = shallowMount(PlanPicker, {
      props: {
        plans: [],
        planId: 'march',
        planName: 'März',
        planDate: '2026-03-01',
      },
      global,
    })
    expect(wrapper.get('button').text()).toBe('März')
    wrapper.getComponent(CommandItem).vm.$emit('select')
    expect(wrapper.emitted('select')).toEqual([[null]])
    await wrapper.setProps({ planId: null, planName: null, planDate: null })
    expect(wrapper.get('button').text()).toBe('Zuweisen')
    wrapper.getComponent(CommandItem).vm.$emit('select')
    expect(wrapper.emitted('select')).toEqual([[null]])
  })
})

describe('BudgetPicker', () => {
  it('does not allow choosing a budget before a plan is assigned', () => {
    const wrapper = shallowMount(BudgetPicker, {
      props: { planId: null, budgetId: null, budgetName: null },
      global,
    })
    expect(wrapper.text()).toBe('-')
    expect(wrapper.findComponent(Popover).exists()).toBe(false)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('loads only the assigned plan’s budgets and emits both ID and display name', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ budgets: [{ id: 'groceries', name: 'Lebensmittel' }] }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = shallowMount(BudgetPicker, {
      props: { planId: 'march', budgetId: null, budgetName: null },
      global,
    })
    const popover = wrapper.getComponent(Popover)
    popover.vm.$emit('update:open', true)
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/plans/march/budgets')
    const choice = wrapper
      .findAllComponents(CommandItem)
      .find((item) => item.props('value') === 'Lebensmittel')!
    choice.vm.$emit('select')
    await nextTick()
    expect(wrapper.emitted('select')).toEqual([['groceries', 'Lebensmittel']])
    expect(popover.props('open')).toBe(false)
  })

  it('does not offer stale budgets after switching plans when the new request fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ budgets: [{ id: 'old', name: 'März-Budget' }] }),
      )
      .mockResolvedValueOnce(jsonResponse({ error: 'Unavailable' }, 503))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = shallowMount(BudgetPicker, {
      props: { planId: 'march', budgetId: null, budgetName: null },
      global,
    })
    wrapper.getComponent(Popover).vm.$emit('update:open', true)
    await flushPromises()
    expect(wrapper.text()).toContain('März-Budget')
    await wrapper.setProps({ planId: 'april' })
    await flushPromises()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/plans/april/budgets')
    expect(wrapper.text()).not.toContain('März-Budget')
    expect(
      wrapper.findAllComponents(CommandItem).map((item) => item.props('value')),
    ).toEqual(['__kein_budget__'])
  })

  it('ignores a delayed response belonging to the previously selected plan', async () => {
    let resolvePrevious!: (response: Response) => void
    const previousRequest = new Promise<Response>((resolve) => {
      resolvePrevious = resolve
    })
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(previousRequest)
      .mockResolvedValueOnce(
        jsonResponse({ budgets: [{ id: 'current', name: 'April-Budget' }] }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = shallowMount(BudgetPicker, {
      props: { planId: 'march', budgetId: null, budgetName: null },
      global,
    })
    wrapper.getComponent(Popover).vm.$emit('update:open', true)
    await nextTick()
    await wrapper.setProps({ planId: 'april' })
    await flushPromises()
    expect(wrapper.text()).toContain('April-Budget')
    resolvePrevious(
      jsonResponse({ budgets: [{ id: 'old', name: 'März-Budget' }] }),
    )
    await flushPromises()
    expect(wrapper.text()).toContain('April-Budget')
    expect(wrapper.text()).not.toContain('März-Budget')
  })
})
