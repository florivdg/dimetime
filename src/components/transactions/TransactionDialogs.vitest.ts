import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { shadcnSelect } from '../../../test/component-mocks'
import { setDialogOpen } from '../../../test/dialog-helpers'
import { sampleTransactionRow } from '../../../test/fixtures'
import TransactionCreateDialog from './TransactionCreateDialog.vue'
import TransactionEditDialog from './TransactionEditDialog.vue'
import TransactionMoveDialog from './TransactionMoveDialog.vue'
import CopyFromPlanDialog from './CopyFromPlanDialog.vue'

vi.mock('@/components/ui/switch', async () => {
  const { shadcnCheckbox } = await import('../../../test/component-mocks')
  return { Switch: shadcnCheckbox.Checkbox }
})
vi.mock('vue-sonner', () => ({ toast: { success: vi.fn() } }))

afterEach(() => {
  vi.restoreAllMocks()
})

const { Select, SelectItem } = shadcnSelect

const confirmation = {
  code: 'BUDGET_LINKS_CONFIRMATION_REQUIRED',
  affectedBankTransactions: 2,
  affectedSplits: 1,
}
const plans = [
  {
    id: 'plan-1',
    name: 'Aktueller Plan',
    date: '2026-03-01',
    isArchived: false,
  },
  { id: 'plan-2', name: 'Zielplan', date: '2026-04-01', isArchived: false },
  { id: 'plan-3', name: 'Archiv', date: '2026-02-01', isArchived: true },
]

describe('TransactionCreateDialog', () => {
  it('requires name and date, converts euros to cents and emits creation only after success', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(Response.json({}))
    const wrapper = mount(TransactionCreateDialog, {
      props: { open: true, planId: 'plan-1', categories: [] },
    })
    await wrapper.get('form').trigger('submit')
    expect(fetchMock).not.toHaveBeenCalled()
    await wrapper.get('#new-name').setValue('  Strom  ')
    await wrapper.get('#new-date').setValue('2026-03-15')
    await wrapper.get('#new-note').setValue('   ')
    await wrapper.get('input[type="number"]').setValue('12.34')
    await wrapper.get('#new-is-budget').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Strom',
        note: null,
        dueDate: '2026-03-15',
        amount: 1234,
        type: 'expense',
        planId: 'plan-1',
        categoryId: null,
        isDone: false,
        isBudget: true,
      }),
    })
    expect(wrapper.emitted('created')).toHaveLength(1)
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.get<HTMLInputElement>('#new-name').element.value).toBe('')
  })

  it('retains the entered transaction after a rejected creation', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ error: 'Plan ist archiviert' }, { status: 400 }),
    )
    const wrapper = mount(TransactionCreateDialog, {
      props: { open: true, planId: 'plan-1', categories: [] },
    })
    await wrapper.get('#new-name').setValue('Strom')
    await wrapper.get('#new-date').setValue('2026-03-15')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('error')).toEqual([['Plan ist archiviert']])
    expect(wrapper.emitted('created')).toBeUndefined()
    expect(wrapper.get<HTMLInputElement>('#new-name').element.value).toBe(
      'Strom',
    )
    expect(
      wrapper.get('button[type="submit"]').attributes('disabled'),
    ).toBeUndefined()
  })
})

describe('TransactionEditDialog', () => {
  it('populates the transaction and submits normalized fields without unsolicited confirmation', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(Response.json({}))
    const wrapper = mount(TransactionEditDialog, {
      props: { open: true, transaction: sampleTransactionRow, categories: [] },
    })
    expect(wrapper.get<HTMLInputElement>('#edit-name').element.value).toBe(
      'Rent',
    )
    expect(
      wrapper.get<HTMLInputElement>('input[type="number"]').element.value,
    ).toBe('1000')
    await wrapper.get('#edit-name').setValue('  Neue Miete ')
    await wrapper.get('input[type="number"]').setValue('1001.25')
    await wrapper.get('#edit-note').setValue('  Anpassung ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/transactions/tx-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Neue Miete',
        note: 'Anpassung',
        dueDate: '2026-03-01',
        amount: 100125,
        type: 'expense',
        categoryId: null,
        isDone: false,
        isBudget: false,
        confirmClearBudgetLinks: false,
      }),
    })
    expect(wrapper.emitted('updated')).toHaveLength(1)
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('shows affected budget links and blocks key-repeat before an explicit confirmed retry', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000)
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(Response.json(confirmation, { status: 409 }))
      .mockResolvedValueOnce(Response.json({}))
    const wrapper = mount(TransactionEditDialog, {
      props: {
        open: true,
        transaction: { ...sampleTransactionRow, isBudget: true },
        categories: [],
      },
    })
    await wrapper.get('#edit-is-budget').setValue(false)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('2 Banktransaktionen und 1 Split')
    expect(wrapper.text()).toContain('Trotzdem fortfahren')
    expect(wrapper.emitted('updated')).toBeUndefined()
    expect(wrapper.emitted('error')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    now.mockReturnValue(1500)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(
      JSON.parse(fetchMock.mock.calls[1]![1]!.body as string),
    ).toMatchObject({ isBudget: false, confirmClearBudgetLinks: true })
    expect(wrapper.emitted('updated')).toHaveLength(1)
  })

  it('closes and explains why archived-plan transactions cannot be edited', () => {
    const wrapper = mount(TransactionEditDialog, {
      props: {
        open: true,
        transaction: { ...sampleTransactionRow, planIsArchived: true },
        categories: [],
      },
    })
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.emitted('error')).toEqual([
      ['Transaktion kann nicht bearbeitet werden - Plan ist archiviert'],
    ])
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('TransactionMoveDialog', () => {
  it('excludes the current and archived plans and sends the selected target', async () => {
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(Response.json({ plans }))
      .mockResolvedValueOnce(Response.json({}))
    const wrapper = mount(TransactionMoveDialog, {
      props: {
        open: false,
        transaction: sampleTransactionRow,
        currentPlanId: 'plan-1',
      },
    })
    expect(fetchMock).not.toHaveBeenCalled()
    await setDialogOpen(wrapper, true)
    await flushPromises()
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/plans?includeArchived=false',
    )
    expect(
      wrapper.findAllComponents(SelectItem).map((option) => option.text()),
    ).toEqual(['Zielplan'])
    const move = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Verschieben')!
    expect(move.attributes('disabled')).toBeDefined()
    wrapper.getComponent(Select).vm.$emit('update:modelValue', 'plan-2')
    await flushPromises()
    await move.trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/transactions/tx-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: 'plan-2',
        confirmClearBudgetLinks: false,
      }),
    })
    expect(wrapper.emitted('moved')).toEqual([['plan-2', 'Zielplan']])
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('requires a second action when moving would clear existing budget assignments', async () => {
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(Response.json({ plans }))
      .mockResolvedValueOnce(Response.json(confirmation, { status: 409 }))
      .mockResolvedValueOnce(Response.json({}))
    const wrapper = mount(TransactionMoveDialog, {
      props: {
        open: false,
        transaction: sampleTransactionRow,
        currentPlanId: 'plan-1',
      },
    })
    await setDialogOpen(wrapper, true)
    await flushPromises()
    wrapper.getComponent(Select).vm.$emit('update:modelValue', 'plan-2')
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Verschieben')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('2 Banktransaktionen und 1 Split')
    expect(wrapper.emitted('moved')).toBeUndefined()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Trotzdem fortfahren')!
      .trigger('click')
    await flushPromises()
    expect(JSON.parse(fetchMock.mock.calls[2]![1]!.body as string)).toEqual({
      planId: 'plan-2',
      confirmClearBudgetLinks: true,
    })
    expect(wrapper.emitted('moved')).toHaveLength(1)
  })
})

describe('CopyFromPlanDialog', () => {
  it('loads all source transactions, copies only selected IDs and reports the server count', async () => {
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(Response.json({ plans }))
      .mockResolvedValueOnce(
        Response.json({
          transactions: [
            sampleTransactionRow,
            { ...sampleTransactionRow, id: 'tx-2', name: 'Strom' },
          ],
        }),
      )
      .mockResolvedValueOnce(Response.json({ count: 1 }))
    const wrapper = mount(CopyFromPlanDialog, {
      props: { open: false, planId: 'plan-1', planDate: '2026-03-01' },
    })
    await setDialogOpen(wrapper, true)
    await flushPromises()
    expect(
      wrapper
        .findAllComponents(SelectItem)
        .map((option) => option.text().replace(/\s+/g, ' ')),
    ).toEqual(['Zielplan', 'Archiv (archiviert)'])
    wrapper.getComponent(Select).vm.$emit('update:modelValue', 'plan-3')
    await flushPromises()
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/transactions?planId=plan-3&limit=-1&sortBy=dueDate&sortDir=asc&hideZeroValue=false',
    )
    await wrapper.findAll('input[type="checkbox"]')[1]!.setValue(true)
    expect(wrapper.text()).toContain('1 von 2 ausgewählt')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '1 Transaktionen kopieren')!
      .trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/transactions/bulk-copy',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetPlanId: 'plan-1',
          transactionIds: ['tx-2'],
        }),
      },
    )
    expect(wrapper.emitted('copied')).toEqual([[1]])
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('clears the selection when the source plan changes, including a failed load', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ plans }))
      .mockResolvedValueOnce(
        Response.json({ transactions: [sampleTransactionRow] }),
      )
      .mockResolvedValueOnce(
        Response.json({ error: 'Offline' }, { status: 503 }),
      )
    const wrapper = mount(CopyFromPlanDialog, {
      props: { open: false, planId: 'plan-1', planDate: '2026-03-01' },
    })
    await setDialogOpen(wrapper, true)
    await flushPromises()
    wrapper.getComponent(Select).vm.$emit('update:modelValue', 'plan-2')
    await flushPromises()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    wrapper.getComponent(Select).vm.$emit('update:modelValue', 'plan-3')
    await flushPromises()
    expect(wrapper.emitted('error')).toEqual([
      ['Transaktionen konnten nicht geladen werden.'],
    ])
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text() === '0 Transaktionen kopieren')!
        .attributes('disabled'),
    ).toBeDefined()
    expect(wrapper.find('tbody').exists()).toBe(false)
    expect(wrapper.emitted('copied')).toBeUndefined()
  })
})
