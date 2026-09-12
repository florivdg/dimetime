import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { DefineComponent } from 'vue'
import { Checkbox as CheckboxComponent } from '@/components/ui/checkbox'
import { DropdownMenuItem as DropdownMenuItemComponent } from '@/components/ui/dropdown-menu'
import type { BankTransactionRow } from '@/lib/bank-transactions'
import BankTransactionTable from './BankTransactionTable.vue'
import BudgetPickerComponent from './BudgetPicker.vue'
import PlanPickerComponent from './PlanPicker.vue'
import NoteEditorComponent from './NoteEditor.vue'

const Checkbox = CheckboxComponent as unknown as DefineComponent<{
  modelValue: boolean | 'indeterminate'
}>
const DropdownMenuItem = DropdownMenuItemComponent as unknown as DefineComponent
const BudgetPicker = BudgetPickerComponent as unknown as DefineComponent
const PlanPicker = PlanPickerComponent as unknown as DefineComponent
const NoteEditor = NoteEditorComponent as unknown as DefineComponent

function row(overrides: Partial<BankTransactionRow> = {}): BankTransactionRow {
  return {
    id: 'transaction',
    rowType: 'transaction',
    parentId: null,
    bookingDate: '2026-03-15',
    counterparty: 'Supermarkt',
    description: null,
    amountCents: -12345,
    label: null,
    sourceName: 'Girokonto',
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
    createdAt: new Date('2026-03-15T12:00:00Z'),
    sortOrder: 0,
    ...overrides,
  }
}

function render(rows: BankTransactionRow[] = [row()]) {
  return mount(BankTransactionTable, {
    props: {
      rows,
      plans: [],
      isLoading: false,
      searchQuery: '',
      sortBy: 'bookingDate',
      sortDir: 'desc',
      hasActiveFilters: false,
      selectedIds: new Set<string>(),
    },
    global: {
      stubs: { BudgetPicker: true, PlanPicker: true, NoteEditor: true },
    },
  })
}

describe('BankTransactionTable', () => {
  it('distinguishes a new account from an empty filtered result and loading', async () => {
    const wrapper = render([])
    expect(wrapper.text()).toContain(
      'Importiere Bankdaten über den Import-Button.',
    )
    await wrapper.setProps({ hasActiveFilters: true })
    expect(wrapper.text()).toBe('Keine Transaktionen gefunden.')
    await wrapper.setProps({ isLoading: true })
    expect(wrapper.text()).not.toContain('Keine Transaktionen')
    expect(wrapper.find('.animate-spin').exists()).toBe(true)
  })

  it('displays money, booking status and split labels for their corresponding rows', () => {
    const wrapper = render([
      row(),
      row({
        id: 'split',
        rowType: 'split',
        parentId: 'parent',
        label: 'Lebensmittel',
        amountCents: -2500,
        status: 'pending',
        isArchived: true,
      }),
    ])
    const rows = wrapper.findAll('tbody tr')
    expect(rows[0].text()).toContain('Supermarkt')
    expect(rows[0].text()).toContain('-123,45 €')
    expect(rows[0].text()).toContain('Gebucht')
    expect(rows[1].text()).toContain('Lebensmittel')
    expect(rows[1].text()).toContain('-25,00 €')
    expect(rows[1].text()).toContain('Ausstehend')
    expect(rows[1].text()).toContain('Archiviert')
  })

  it('reports sort columns and preserves the shift modifier when selecting a row', async () => {
    const wrapper = render()
    const sortButtons = wrapper.findAll('thead button')
    await sortButtons[0].trigger('click')
    await sortButtons[1].trigger('click')
    expect(wrapper.emitted('sort')).toEqual([['bookingDate'], ['amountCents']])
    await wrapper.get('tbody td').trigger('click', { shiftKey: true })
    expect(wrapper.emitted('toggle-select')).toEqual([['transaction', true]])
  })

  it('keeps select-all indeterminate until every visible row is selected', async () => {
    const wrapper = render([row(), row({ id: 'second' })])
    const all = wrapper.findAllComponents(Checkbox)[0]
    expect(all.props('modelValue')).toBe(false)
    await wrapper.setProps({ selectedIds: new Set(['transaction']) })
    expect(all.props('modelValue')).toBe('indeterminate')
    await wrapper.setProps({ selectedIds: new Set(['transaction', 'second']) })
    expect(all.props('modelValue')).toBe(true)
    all.vm.$emit('update:modelValue', false)
    expect(wrapper.emitted('toggle-select-all')).toEqual([[]])
  })

  it('routes plan, budget and note edits to the correct split ID', () => {
    const wrapper = render([
      row(),
      row({ id: 'split', rowType: 'split', parentId: 'parent' }),
    ])
    wrapper.findAllComponents(PlanPicker)[1].vm.$emit('select', 'plan')
    wrapper
      .findAllComponents(BudgetPicker)[1]
      .vm.$emit('select', 'budget', 'Haushalt')
    wrapper
      .findAllComponents(NoteEditor)[1]
      .vm.$emit('update:note', 'split', 'Quittung vorhanden')
    expect(wrapper.emitted('update:plan')).toEqual([['split', 'plan']])
    expect(wrapper.emitted('update:budget')).toEqual([
      ['split', 'budget', 'Haushalt'],
    ])
    expect(wrapper.emitted('update:note')).toEqual([
      ['split', 'Quittung vorhanden'],
    ])
  })

  it('offers split undo only for active children and never offers child deletion', async () => {
    const wrapper = render([
      row({ id: 'child', rowType: 'split', parentId: 'parent' }),
    ])
    const actions = wrapper.findAllComponents(DropdownMenuItem)
    expect(actions.map((action) => action.text())).toEqual([
      'Aufteilung aufheben',
      'Archivieren',
    ])
    actions[0].vm.$emit('click')
    actions[1].vm.$emit('click')
    expect(wrapper.emitted('undo-split')).toEqual([['parent']])
    expect(wrapper.emitted('archive')).toEqual([['child', true, 'split']])
    await wrapper.setProps({
      rows: [
        row({
          id: 'child',
          rowType: 'split',
          parentId: 'parent',
          isArchived: true,
        }),
      ],
    })
    const archivedActions = wrapper.findAllComponents(DropdownMenuItem)
    expect(archivedActions.map((action) => action.text())).toEqual([
      'Entarchivieren',
    ])
    archivedActions[0].vm.$emit('click')
    expect(wrapper.emitted('archive')?.at(-1)).toEqual([
      'child',
      false,
      'split',
    ])
  })
})
