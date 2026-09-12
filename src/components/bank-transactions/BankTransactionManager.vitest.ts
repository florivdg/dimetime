import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick, type DefineComponent } from 'vue'
import type { BankTransactionRow } from '@/lib/bank-transactions'
import { jsonResponse } from '@/../test/composable-helpers'
import BankTransactionManager from './BankTransactionManager.vue'
import BankTransactionTableComponent from './BankTransactionTable.vue'
import BankImportDialogComponent from './BankImportDialog.vue'
import SplitTransactionDialogComponent from './SplitTransactionDialog.vue'

// Astro describes imported SFCs as functional components. Select VTU's Vue
// wrapper overload for components that are mounted as Vue children here.
const BankTransactionTable =
  BankTransactionTableComponent as unknown as DefineComponent<{
    rows: BankTransactionRow[]
    selectedIds: Set<string>
  }>
const BankImportDialog =
  BankImportDialogComponent as unknown as DefineComponent<{ open: boolean }>
const SplitTransactionDialog =
  SplitTransactionDialogComponent as unknown as DefineComponent<{
    open: boolean
    transaction: BankTransactionRow | null
  }>

const { success, error } = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))
vi.mock('vue-sonner', () => ({ toast: { success, error } }))

function transaction(
  id: string,
  overrides: Partial<BankTransactionRow> = {},
): BankTransactionRow {
  return {
    id,
    rowType: 'transaction',
    parentId: null,
    bookingDate: '2026-03-15',
    counterparty: 'Edeka',
    description: null,
    amountCents: -2000,
    label: null,
    sourceName: 'ING',
    status: 'booked',
    planId: 'march',
    planDate: '2026-03-01',
    planName: 'März',
    budgetId: null,
    budgetName: null,
    isArchived: false,
    note: 'Original',
    purpose: null,
    isSplit: false,
    createdAt: new Date('2026-03-15T12:00:00Z'),
    sortOrder: 0,
    ...overrides,
  }
}
const pagination = { total: 3, page: 1, limit: 20, totalPages: 1 }

function render(
  rows = [
    transaction('first'),
    transaction('child', { rowType: 'split', parentId: 'parent' }),
    transaction('last'),
  ],
) {
  return mount(BankTransactionManager, {
    props: {
      initialRows: rows,
      initialPagination: pagination,
      initialSources: [],
      initialPlans: [],
    },
    global: {
      stubs: {
        BankTransactionTable: true,
        BankImportDialog: true,
        SplitTransactionDialog: true,
        PaginationControls: true,
      },
    },
  })
}

describe('BankTransactionManager', () => {
  let previousUrl: string
  beforeEach(() => {
    previousUrl = window.location.href
    window.history.replaceState({}, '', '/')
    success.mockReset()
    error.mockReset()
  })
  afterEach(() => window.history.replaceState({}, '', previousUrl))

  it('selects a contiguous range across transactions and splits and toggles the whole page', async () => {
    const wrapper = render()
    const table = wrapper.getComponent(BankTransactionTable)
    table.vm.$emit('toggle-select', 'first', false)
    table.vm.$emit('toggle-select', 'last', true)
    await nextTick()
    expect(table.props('selectedIds')).toEqual(
      new Set(['first', 'child', 'last']),
    )
    expect(wrapper.text()).toContain('3 ausgewählt')
    table.vm.$emit('toggle-select-all')
    await nextTick()
    expect(table.props('selectedIds')).toEqual(new Set())
    table.vm.$emit('toggle-select-all')
    await nextTick()
    expect(table.props('selectedIds')).toEqual(
      new Set(['first', 'child', 'last']),
    )
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('archives transaction and split IDs separately and removes stale selection after refresh', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(
        jsonResponse({ rows: [], pagination: { ...pagination, total: 0 } }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = render()
    const table = wrapper.getComponent(BankTransactionTable)
    table.vm.$emit('toggle-select-all')
    await nextTick()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Archivieren')!
      .trigger('click')
    await flushPromises()
    expect(fetchMock.mock.calls[0]).toEqual([
      '/api/bank-transactions/bulk-archive',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: ['first', 'last'],
          splitIds: ['child'],
          isArchived: true,
        }),
      },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(table.props('rows')).toEqual([])
    expect(table.props('selectedIds')).toEqual(new Set())
    expect(success).toHaveBeenCalledWith('3 Transaktion(en) archiviert')
  })

  it('preserves the selection and shows an error when archiving fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'Unavailable' }, 503))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = render()
    const table = wrapper.getComponent(BankTransactionTable)
    table.vm.$emit('toggle-select', 'child', false)
    await nextTick()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Archivieren')!
      .trigger('click')
    await flushPromises()
    expect(table.props('selectedIds')).toEqual(new Set(['child']))
    expect(wrapper.text()).toContain(
      'Archivierung konnte nicht durchgeführt werden.',
    )
    expect(error).toHaveBeenCalledWith(
      'Archivierung konnte nicht durchgeführt werden.',
    )
    expect(success).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('disables budget assignment when selected rows do not share a plan', async () => {
    const wrapper = render([
      transaction('first'),
      transaction('other', { planId: 'april' }),
    ])
    const table = wrapper.getComponent(BankTransactionTable)
    table.vm.$emit('toggle-select', 'first', false)
    await nextTick()
    const budgetButton = () =>
      wrapper
        .findAll('button')
        .find((button) => button.text() === 'Budget zuweisen')!
    expect(budgetButton().element.disabled).toBe(false)
    table.vm.$emit('toggle-select', 'other', false)
    await nextTick()
    expect(budgetButton().element.disabled).toBe(true)
    await budgetButton().trigger('click')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('changes sort direction, reloads the matching query and clears selection', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ rows: [], pagination }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = render()
    const table = wrapper.getComponent(BankTransactionTable)
    table.vm.$emit('toggle-select', 'first', false)
    table.vm.$emit('sort', 'amountCents')
    await flushPromises()
    let query = new URL(fetchMock.mock.calls[0][0], 'http://localhost')
      .searchParams
    expect(query.get('sortBy')).toBe('amountCents')
    expect(query.get('sortDir')).toBe('asc')
    expect(query.get('page')).toBe('1')
    expect(table.props('selectedIds')).toEqual(new Set())
    table.vm.$emit('sort', 'amountCents')
    await flushPromises()
    query = new URL(fetchMock.mock.calls[1][0], 'http://localhost').searchParams
    expect(query.get('sortDir')).toBe('desc')
  })

  it('rolls back a rejected split note edit and reports failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'Unavailable' }, 503))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = render()
    const table = wrapper.getComponent(BankTransactionTable)
    table.vm.$emit('update:note', 'child', 'Changed')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/bank-transactions/splits/child',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'Changed' }),
      },
    )
    expect(
      table.props('rows').find((row: BankTransactionRow) => row.id === 'child')
        ?.note,
    ).toBe('Original')
    expect(error).toHaveBeenCalledWith('Notiz konnte nicht gespeichert werden.')
    expect(success).not.toHaveBeenCalled()
  })

  it('passes split amounts to the chosen transaction and refreshes after success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ rows: [], pagination }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = render()
    const table = wrapper.getComponent(BankTransactionTable)
    table.vm.$emit('open-split', table.props('rows')[0])
    await nextTick()
    const dialog = wrapper.getComponent(SplitTransactionDialog)
    expect(dialog.props('open')).toBe(true)
    expect(dialog.props('transaction')?.id).toBe('first')
    const splits = [
      { amountCents: -1500, label: 'Lebensmittel' },
      { amountCents: -500, label: 'Haushalt' },
    ]
    dialog.vm.$emit('split', splits)
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/bank-transactions/first/split',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ splits }),
      },
    )
    expect(dialog.props('open')).toBe(false)
    expect(success).toHaveBeenCalledWith('Transaktion aufgeteilt')
  })

  it('refreshes both transactions and sources after a completed import', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          jsonResponse(
            url === '/api/import-sources'
              ? { sources: [] }
              : { rows: [], pagination },
          ),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = render()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Import')!
      .trigger('click')
    const dialog = wrapper.getComponent(BankImportDialog)
    expect(dialog.props('open')).toBe(true)
    dialog.vm.$emit('imported')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledWith('/api/import-sources')
    expect(
      fetchMock.mock.calls.some(([url]) =>
        url.startsWith('/api/bank-transactions?'),
      ),
    ).toBe(true)
  })
})
