import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { shadcnSelect } from '../../../test/component-mocks'
import { makePlan } from '../../../test/plan-preset-fixtures'
import PlanManager from './PlanManager.vue'

const global = { stubs: { PlanCreateDialog: true, PlanTable: true } }
const props = {
  initialPlans: [
    makePlan(),
    makePlan({ id: 'plan-2', name: 'Oktober', notes: 'Urlaub' }),
  ],
  availableYears: [2026, 2025],
}

describe('PlanManager', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/')
    vi.useRealTimers()
  })

  it('filters server-provided plans by notes without fetching', async () => {
    vi.useFakeTimers()
    const wrapper = mount(PlanManager, { props, global })
    await wrapper.get('input[name="query"]').setValue('urlaub')
    expect(wrapper.getComponent({ name: 'PlanTable' }).props('plans')).toEqual([
      props.initialPlans[1],
    ])
    expect(fetch).not.toHaveBeenCalled()
    await wrapper.get('input[name="query"]').trigger('keyup.escape')
    await vi.runAllTimersAsync()
    await flushPromises()
    expect(
      wrapper.getComponent({ name: 'PlanTable' }).props('plans'),
    ).toHaveLength(2)
  })

  it('requests the chosen year and replaces the visible plans with the response', async () => {
    const returned = makePlan({ id: 'old-plan', date: '2025-01-01' })
    vi.mocked(fetch).mockResolvedValue(Response.json({ plans: [returned] }))
    const wrapper = mount(PlanManager, { props, global })
    wrapper
      .getComponent(shadcnSelect.Select)
      .vm.$emit('update:modelValue', '2025')
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith(
      '/api/plans?includeArchived=true&year=2025',
    )
    expect(wrapper.getComponent({ name: 'PlanTable' }).props('plans')).toEqual([
      expect.objectContaining({ id: 'old-plan' }),
    ])
  })

  it('allows resetting archive visibility when it is the only changed filter', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ plans: props.initialPlans }),
    )
    const wrapper = mount(PlanManager, { props, global })
    await wrapper.get('#hide-archived').trigger('click')
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith('/api/plans?year=all')
    expect(
      wrapper.get('[title="Filter zurücksetzen"]').attributes('disabled'),
    ).toBeUndefined()
    await wrapper.get('[title="Filter zurücksetzen"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('#hide-archived').attributes('aria-checked')).toBe(
      'false',
    )
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/plans?includeArchived=true&year=all',
    )
  })

  it('refreshes after a child mutation and displays refresh failures', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))
    const wrapper = mount(PlanManager, { props, global })
    wrapper.getComponent({ name: 'PlanCreateDialog' }).vm.$emit('created')
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith(
      '/api/plans?includeArchived=true&year=all',
    )
    expect(wrapper.text()).toContain('Pläne konnten nicht geladen werden.')
    expect(wrapper.getComponent({ name: 'PlanTable' }).props('isLoading')).toBe(
      false,
    )
    expect(wrapper.getComponent({ name: 'PlanTable' }).props('plans')).toEqual(
      props.initialPlans,
    )
  })
})
