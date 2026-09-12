import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

vi.mock('@/components/ui/switch', () => ({
  Switch: defineComponent({
    props: ['modelValue'],
    setup: (props) => () =>
      h('input', { type: 'checkbox', checked: props.modelValue }),
  }),
}))
vi.mock('@/components/ui/pagination', () => ({
  Pagination: defineComponent({
    setup(_, { slots }) {
      return () => h('nav', {}, slots.default?.({ page: 1 }))
    },
  }),
  PaginationContent: defineComponent({
    setup(_, { slots }) {
      return () => h('ul', {}, slots.default?.({ items: [] }))
    },
  }),
  PaginationEllipsis: defineComponent({ setup: () => () => h('li') }),
  PaginationFirst: defineComponent({ setup: () => () => h('li') }),
  PaginationItem: defineComponent({ setup: () => () => h('li') }),
  PaginationLast: defineComponent({ setup: () => () => h('li') }),
  PaginationNext: defineComponent({ setup: () => () => h('li') }),
  PaginationPrevious: defineComponent({ setup: () => () => h('li') }),
}))
vi.mock('./PresetCreateDialog.vue', () => ({
  default: defineComponent({
    setup(_, { slots }) {
      return () => h('div', {}, slots.default?.())
    },
  }),
}))
vi.mock('./PresetTable.vue', () => ({
  default: defineComponent({
    props: ['presets'],
    emits: ['error'],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-testid': 'preset-table' }, [
          ...props.presets.map((preset: { name: string }) =>
            h('span', preset.name),
          ),
          h(
            'button',
            {
              'data-testid': 'emit-error',
              onClick: () => emit('error', 'Laden fehlgeschlagen'),
            },
            'Fehler auslösen',
          ),
        ])
    },
  }),
}))

const PresetManager = (await import('./PresetManager.vue')).default

const preset = {
  id: 'p-1',
  name: 'Miete',
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
  tags: [],
}

function mountManager(initialPresets = [preset]) {
  return mount(PresetManager, {
    props: {
      initialPresets,
      initialPagination: {
        total: initialPresets.length,
        page: 1,
        limit: 20,
        totalPages: initialPresets.length > 0 ? 1 : 0,
      },
      categories: [],
    },
  })
}

describe('PresetManager.vue', () => {
  afterEach(() => vi.useRealTimers())

  it('passes initial presets to the table and exposes creation', () => {
    const wrapper = mountManager()

    expect(wrapper.get('[data-testid="preset-table"]').text()).toContain(
      'Miete',
    )
    expect(wrapper.text()).toContain('Neue Vorlage')
  })

  it('surfaces child errors temporarily', async () => {
    vi.useFakeTimers()
    const wrapper = mountManager([])

    await wrapper.get('[data-testid="emit-error"]').trigger('click')
    expect(wrapper.text()).toContain('Laden fehlgeschlagen')

    await vi.advanceTimersByTimeAsync(5000)
    expect(wrapper.text()).not.toContain('Laden fehlgeschlagen')
  })
})
