import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { useBankTransactions } from './useBankTransactions'
import { jsonResponse } from '@/../test/composable-helpers'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Filters = any

function makeFilters(
  overrides: Partial<Record<string, unknown>> = {},
): Filters {
  const state = ref({
    search: '',
    sourceId: 'all',
    status: 'all',
    planId: 'all',
    dateFrom: '',
    dateTo: '',
    showArchived: false,
    sortBy: 'bookingDate',
    sortDir: 'desc',
    page: 1,
    ...overrides,
  })

  return new Proxy({ state: state.value } as Record<string, unknown>, {
    get(target, prop) {
      if (prop === 'state') return state.value
      const key = prop as string
      if (key in state.value) {
        return {
          get value() {
            return (state.value as Record<string, unknown>)[key]
          },
          set value(v: unknown) {
            ;(state.value as Record<string, unknown>)[key] = v
          },
        }
      }
      return target[prop as keyof typeof target]
    },
  })
}

function makeInitialData() {
  return {
    rows: [
      {
        id: 'r-1',
        rowType: 'transaction' as const,
        parentId: null,
        bookingDate: '2026-03-01',
        counterparty: 'Edeka',
        description: 'Einkauf',
        amountCents: -2000,
        label: null,
        sourceName: 'ING',
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
      },
    ],
    pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
    sources: [],
    plans: [
      { id: 'plan-1', name: 'March', date: '2026-03-01', isArchived: false },
    ] as never,
  }
}

type Hook = ReturnType<typeof useBankTransactions>

function setupHook(filters: Filters): Hook {
  const initialData = makeInitialData()
  let captured: Hook | undefined
  const Comp = defineComponent({
    setup() {
      captured = useBankTransactions(filters as never, initialData as never)
      return () => h('div')
    },
  })
  mount(Comp)
  return captured as Hook
}

let originalFetch: typeof globalThis.fetch
let mockFetch: ReturnType<typeof vi.fn>

beforeEach(() => {
  originalFetch = globalThis.fetch
  mockFetch = vi.fn()
  globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

/** Prime the fetch mock for a mutation (200) followed by a list reload. */
function primeReload() {
  mockFetch.mockResolvedValueOnce(jsonResponse({})).mockResolvedValueOnce(
    jsonResponse({
      rows: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
    }),
  )
}

describe('useBankTransactions', () => {
  it('exposes initial rows and pagination', () => {
    const hook = setupHook(makeFilters())
    expect(hook.rows.value).toHaveLength(1)
    expect(hook.pagination.value.total).toBe(1)
  })

  it('updateTransactionPlan applies optimistic update on success', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}))
    const hook = setupHook(makeFilters())
    const ok = await hook.updateTransactionPlan('r-1', 'plan-1')
    expect(ok).toBe(true)
    expect(hook.rows.value[0].planId).toBe('plan-1')
    expect(hook.rows.value[0].planName).toBe('March')
  })

  it('updateTransactionPlan rolls back on failure', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}, 500))
    const hook = setupHook(makeFilters())
    const ok = await hook.updateTransactionPlan('r-1', 'plan-1')
    expect(ok).toBe(false)
    expect(hook.rows.value[0].planId).toBeNull()
  })

  it('updateTransactionPlan returns false for unknown id', async () => {
    const hook = setupHook(makeFilters())
    const ok = await hook.updateTransactionPlan('missing', 'plan-1')
    expect(ok).toBe(false)
  })

  it('updateTransactionNote applies optimistic update and rolls back', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}))
    const hook = setupHook(makeFilters())
    let ok = await hook.updateTransactionNote('r-1', 'memo')
    expect(ok).toBe(true)
    expect(hook.rows.value[0].note).toBe('memo')

    mockFetch.mockResolvedValueOnce(jsonResponse({}, 500))
    ok = await hook.updateTransactionNote('r-1', 'rollback')
    expect(ok).toBe(false)
    expect(hook.rows.value[0].note).toBe('memo')
  })

  it('updateTransactionBudget optimistic update and rollback', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}))
    const hook = setupHook(makeFilters())
    let ok = await hook.updateTransactionBudget('r-1', 'b-1', 'Budget A')
    expect(ok).toBe(true)
    expect(hook.rows.value[0].budgetName).toBe('Budget A')

    mockFetch.mockResolvedValueOnce(jsonResponse({}, 500))
    ok = await hook.updateTransactionBudget('r-1', 'b-2', 'B')
    expect(ok).toBe(false)
    expect(hook.rows.value[0].budgetName).toBe('Budget A')
  })

  it('bulkArchiveTransactions reloads on success', async () => {
    primeReload()
    const hook = setupHook(makeFilters())
    const ok = await hook.bulkArchiveTransactions(['r-1'], true)
    expect(ok).toBe(true)
  })

  it('bulkAssignPlan sets error message on failure', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 500))
    const hook = setupHook(makeFilters())
    const ok = await hook.bulkAssignPlan(['r-1'], 'plan-1')
    expect(ok).toBe(false)
    expect(hook.errorMessage.value).toBe('Plan konnte nicht zugewiesen werden.')
  })

  it('deleteTransaction reloads on success', async () => {
    primeReload()
    const hook = setupHook(makeFilters())
    const ok = await hook.deleteTransaction('r-1')
    expect(ok).toBe(true)
  })

  it('splitTransaction posts splits and reloads', async () => {
    primeReload()
    const hook = setupHook(makeFilters())
    const ok = await hook.splitTransaction('r-1', [
      { amountCents: -1000 },
      { amountCents: -1000 },
    ])
    expect(ok).toBe(true)
  })

  it('unsplitTransaction posts DELETE and reloads', async () => {
    primeReload()
    const hook = setupHook(makeFilters())
    const ok = await hook.unsplitTransaction('r-1')
    expect(ok).toBe(true)
  })

  it('loadSources updates sources on success', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ sources: [{ id: 'src-1', name: 'X' }] }),
    )
    const hook = setupHook(makeFilters())
    await hook.loadSources()
    expect(hook.sources.value).toHaveLength(1)
  })

  it('loadPlans updates plans on success', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ plans: [{ id: 'p-1', date: '2026-04-01' }] }),
    )
    const hook = setupHook(makeFilters())
    await hook.loadPlans()
    expect(hook.plans.value).toHaveLength(1)
  })
})
