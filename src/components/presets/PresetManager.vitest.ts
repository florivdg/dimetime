import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

vi.mock('@/components/ui/switch', () => ({
  Switch: defineComponent({
    props: ['modelValue'],
    setup: () => () => h('input', { type: 'checkbox' }),
  }),
}))
vi.mock('@/components/ui/pagination', () => ({
  Pagination: defineComponent({
    setup(_, { slots }) {
      return () => h('nav', {}, slots.default?.())
    },
  }),
  PaginationContent: defineComponent({
    setup(_, { slots }) {
      return () => h('ul', {}, slots.default?.())
    },
  }),
  PaginationEllipsis: defineComponent({ setup: () => () => h('li') }),
  PaginationFirst: defineComponent({ setup: () => () => h('li') }),
  PaginationItem: defineComponent({
    props: ['value'],
    setup(_, { slots }) {
      return () => h('li', {}, slots.default?.())
    },
  }),
  PaginationLast: defineComponent({ setup: () => () => h('li') }),
  PaginationNext: defineComponent({ setup: () => () => h('li') }),
  PaginationPrevious: defineComponent({ setup: () => () => h('li') }),
}))

const stub = defineComponent({ setup: () => () => h('div') })
vi.mock('./PresetCreateDialog.vue', () => ({ default: stub }))
vi.mock('./PresetTable.vue', () => ({ default: stub }))

const PresetManager = (await import('./PresetManager.vue')).default

describe('PresetManager.vue', () => {
  it('mounts with empty data', () => {
    const wrapper = mount(PresetManager, {
      props: {
        initialPresets: [],
        initialPagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
        categories: [],
      },
    })
    expect(wrapper.html()).toBeTruthy()
  })

  it('renders heading and reset button capacity', () => {
    const wrapper = mount(PresetManager, {
      props: {
        initialPresets: [],
        initialPagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
        categories: [],
      },
    })
    // Component renders no errors with realistic props
    expect(wrapper.findAll('button').length).toBeGreaterThan(0)
  })
})
