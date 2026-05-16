import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { useUrlState } from './useUrlState'

interface Schema extends Record<string, unknown> {
  search: string
  page: number
  active: boolean
  nullable: boolean | null
  type: 'income' | 'expense' | null
  status: 'a' | 'b'
  optional: string | null
}

function setupWith(initialUrl: string) {
  window.history.replaceState({}, '', initialUrl)
  let captured: ReturnType<typeof useUrlState<Schema>> | undefined
  const Comp = defineComponent({
    setup() {
      captured = useUrlState<Schema>({
        search: { type: 'string', default: '', urlKey: 'q', debounce: 50 },
        page: { type: 'number', default: 1 },
        active: { type: 'boolean', default: false },
        nullable: { type: 'nullable-boolean', default: null },
        type: {
          type: 'nullable-enum',
          default: null,
          enumValues: ['income', 'expense'] as const,
        },
        status: {
          type: 'enum',
          default: 'a',
          enumValues: ['a', 'b'] as const,
        },
        optional: { type: 'nullable-string', default: null },
      })
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  return { state: captured as ReturnType<typeof useUrlState<Schema>>, wrapper }
}

afterEach(() => {
  window.history.replaceState({}, '', '/')
})

describe('useUrlState', () => {
  it('hydrates state from URL on mount', async () => {
    const { state } = setupWith('/?q=hello&page=3&active=true&status=b')
    await nextTick()
    expect(state.state.search).toBe('hello')
    expect(state.state.page).toBe(3)
    expect(state.state.active).toBe(true)
    expect(state.state.status).toBe('b')
  })

  it('falls back to defaults for missing URL params', async () => {
    const { state } = setupWith('/')
    await nextTick()
    expect(state.state.search).toBe('')
    expect(state.state.page).toBe(1)
    expect(state.state.active).toBe(false)
    expect(state.state.status).toBe('a')
  })

  it('parses nullable-boolean correctly', async () => {
    const { state } = setupWith('/?nullable=false')
    await nextTick()
    expect(state.state.nullable).toBe(false)
  })

  it('coerces unknown enum to default', async () => {
    const { state } = setupWith('/?status=bogus')
    await nextTick()
    expect(state.state.status).toBe('a')
  })

  it('serializes state back into the URL on change', async () => {
    const { state } = setupWith('/')
    await nextTick()
    state.state.page = 5
    state.state.active = true
    await new Promise((r) => setTimeout(r, 10))
    expect(window.location.search).toContain('page=5')
    expect(window.location.search).toContain('active=true')
  })

  it('reset returns state to defaults', async () => {
    const { state } = setupWith('/?page=5&status=b')
    await nextTick()
    state.reset()
    expect(state.state.page).toBe(1)
    expect(state.state.status).toBe('a')
  })

  it('hasActiveParams reflects whether any field differs from default', async () => {
    const { state } = setupWith('/')
    await nextTick()
    expect(state.hasActiveParams.value).toBe(false)
    state.state.page = 7
    expect(state.hasActiveParams.value).toBe(true)
  })

  it('falls back to defaults for invalid numeric input', async () => {
    const { state } = setupWith('/?page=not-a-number')
    await nextTick()
    expect(state.state.page).toBe(1)
  })

  it('nullable-string returns null for empty string and value otherwise', async () => {
    const { state } = setupWith('/?optional=x')
    await nextTick()
    expect(state.state.optional).toBe('x')
  })

  it('respects custom urlKey override', async () => {
    const { state } = setupWith('/?q=abc')
    await nextTick()
    expect(state.state.search).toBe('abc')
  })
})
