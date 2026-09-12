import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PlanTransactionFilters, {
  type FilterState,
} from './PlanTransactionFilters.vue'

const defaults = (): FilterState => ({
  search: '',
  categoryId: null,
  type: null,
  isDone: null,
  dateFrom: '',
  dateTo: '',
  amountMin: '',
  amountMax: '',
  hideZeroValue: true,
})

describe('PlanTransactionFilters', () => {
  it('allows reset when zero-value visibility is the only changed filter', () => {
    const wrapper = mount(PlanTransactionFilters, {
      props: {
        categories: [],
        filters: { ...defaults(), hideZeroValue: false },
      },
    })
    expect(
      wrapper.get('[title="Filter zurücksetzen"]').attributes('disabled'),
    ).toBeUndefined()
  })

  it('updates search and completion status in the shared filter model', async () => {
    const filters = defaults()
    const wrapper = mount(PlanTransactionFilters, {
      props: { categories: [], filters },
    })
    await wrapper.get('#filter-search').setValue('Miete')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Offen')!
      .trigger('click')
    expect(filters.search).toBe('Miete')
    expect(filters.isDone).toBe(false)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Erledigt')!
      .trigger('click')
    expect(filters.isDone).toBe(true)
  })

  it('resets every filter, including zero-value visibility, and informs the parent', async () => {
    const wrapper = mount(PlanTransactionFilters, {
      props: {
        categories: [],
        filters: {
          search: 'Miete',
          categoryId: 'category-1',
          type: 'expense',
          isDone: false,
          dateFrom: '2026-09-01',
          dateTo: '2026-09-30',
          amountMin: '10',
          amountMax: '100',
          hideZeroValue: false,
        },
      },
    })
    await wrapper.get('[title="Filter zurücksetzen"]').trigger('click')
    expect(wrapper.emitted('update:filters')).toEqual([[defaults()]])
    expect(wrapper.emitted('reset')).toEqual([[]])
  })
})
