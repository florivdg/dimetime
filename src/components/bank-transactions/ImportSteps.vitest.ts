import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { DefineComponent } from 'vue'
import { Select as SelectComponent, SelectItem } from '@/components/ui/select'
import type { ImportSource } from '@/lib/bank-transactions'
import type {
  BankImportCommitResult,
  BankImportPreviewResult,
} from '@/lib/bank-import/service'
import ImportSourceStep from './ImportSourceStep.vue'
import ImportFileStep from './ImportFileStep.vue'
import ImportPreviewStep from './ImportPreviewStep.vue'
import ImportResultStep from './ImportResultStep.vue'

const Select = SelectComponent as unknown as DefineComponent

const source: ImportSource = {
  id: 'checking',
  name: 'Girokonto',
  preset: 'ing_csv_v1',
  sourceKind: 'bank_account',
  bankName: 'ING',
  accountLabel: null,
  accountIdentifier: null,
  defaultPlanAssignment: 'auto_month',
  isActive: true,
  createdAt: new Date('2026-03-01T12:00:00Z'),
  updatedAt: new Date('2026-03-01T12:00:00Z'),
}

describe('ImportSourceStep', () => {
  it('offers only active sources and emits the selected source ID', async () => {
    const wrapper = mount(ImportSourceStep, {
      props: {
        sources: [
          source,
          { ...source, id: 'closed', name: 'Altes Konto', isActive: false },
        ],
      },
    })
    expect(
      wrapper
        .findAllComponents(SelectItem)
        .map((option) => option.attributes('value')),
    ).toEqual(['checking'])
    expect(wrapper.text()).not.toContain('Altes Konto')
    wrapper.getComponent(Select).vm.$emit('update:modelValue', 'checking')
    expect(wrapper.emitted('update:modelValue')).toEqual([['checking']])
  })

  it.each([
    { sources: [], message: 'Keine Import-Quellen vorhanden.' },
    {
      sources: [{ ...source, isActive: false }],
      message: 'Alle Import-Quellen sind derzeit inaktiv.',
    },
  ])(
    'explains why no source can be selected: $message',
    ({ sources, message }) => {
      const wrapper = mount(ImportSourceStep, { props: { sources } })
      expect(wrapper.text()).toContain(message)
      expect(wrapper.findComponent(Select).exists()).toBe(false)
      expect(wrapper.get('a').attributes('href')).toBe('/import-sources')
    },
  )
})

describe('ImportFileStep', () => {
  function mountFile(modelValue: File | null = null): VueWrapper {
    return mount(ImportFileStep, {
      props: {
        selectedSource: source,
        modelValue,
        importTypes: [
          {
            preset: 'ing_csv_v1',
            name: 'ING CSV',
            extensions: ['.csv'],
            requiredColumns: [],
          },
        ],
      },
    })
  }

  it('uses the source format and emits the actual file selected from the input', async () => {
    const wrapper = mountFile()
    expect(wrapper.text()).toContain('Erwartetes Format: ING CSV (.csv)')
    const input = wrapper.get('input[type="file"]')
    expect(input.attributes('accept')).toBe('.csv')
    const file = new File(['date,amount'], 'statement.csv', {
      type: 'text/csv',
    })
    Object.defineProperty(input.element, 'files', {
      value: [file],
      configurable: true,
    })
    await input.trigger('change')
    expect(wrapper.emitted('update:modelValue')).toEqual([[file]])
  })

  it('accepts a dropped file and clears a selected file so it can be chosen again', async () => {
    const file = new File(['a'.repeat(2048)], 'statement.csv')
    const wrapper = mountFile()
    await wrapper
      .get('.border-dashed')
      .trigger('drop', { dataTransfer: { files: [file] } })
    expect(wrapper.emitted('update:modelValue')).toEqual([[file]])
    await wrapper.setProps({ modelValue: file })
    expect(wrapper.text()).toContain('statement.csv')
    expect(wrapper.text()).toContain('2.0 KB')
    expect(wrapper.find('input[type="file"]').exists()).toBe(false)
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[file], [null]])
    await wrapper.setProps({ modelValue: null })
    expect(wrapper.get('input[type="file"]').element).toHaveProperty(
      'value',
      '',
    )
  })

  it('does not overwrite the selection when the file chooser is cancelled', async () => {
    const wrapper = mountFile()
    await wrapper.get('input').trigger('change')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})

const preview: BankImportPreviewResult = {
  previewImportId: 'preview',
  source: { id: source.id, name: source.name, preset: source.preset },
  parser: { preset: source.preset, fileType: 'csv', totalRows: 8 },
  counts: {
    totalRows: 8,
    rowsAfterFileDedup: 7,
    duplicateInFile: 1,
    new: 5,
    wouldUpdate: 2,
  },
  assignment: { assigned: 6, unassigned: 1 },
  warnings: ['Eine Zeile benötigt einen Plan.'],
  samples: [
    {
      bookingDate: '2026-03-15',
      amountCents: -12345,
      currency: 'EUR',
      status: 'booked',
      description: 'Kartenzahlung',
      counterparty: 'Supermarkt',
      dedupeKey: 'a',
      hasPlanAssignment: true,
    },
    {
      bookingDate: '2026-03-16',
      amountCents: 2500,
      currency: 'EUR',
      status: 'pending',
      description: 'Erstattung',
      counterparty: null,
      dedupeKey: 'b',
      hasPlanAssignment: false,
    },
  ],
}

describe('ImportPreviewStep', () => {
  it('shows distinct import counts, warnings and sample transaction outcomes', () => {
    const wrapper = mount(ImportPreviewStep, { props: { preview } })
    expect(
      wrapper
        .get('.grid')
        .findAll('div')
        .map((cell) => cell.text()),
    ).toEqual([
      '8Zeilen',
      '5Neu',
      '2Aktualisierung',
      '1Duplikat',
      '6Plan zugeordnet',
      '1Ohne Plan',
    ])
    expect(wrapper.text()).toContain('Eine Zeile benötigt einen Plan.')
    const rows = wrapper.findAll('tbody tr')
    expect(rows[0].findAll('td').map((cell) => cell.text())).toEqual([
      '15.03.26',
      'Supermarkt',
      '-123,45 €',
      'Gebucht',
      '',
    ])
    expect(rows[0].findAll('td')[4].find('svg').exists()).toBe(true)
    expect(rows[1].findAll('td').map((cell) => cell.text())).toEqual([
      '16.03.26',
      'Erstattung',
      '25,00 €',
      'Ausstehend',
      '-',
    ])
  })

  it('omits the sample table for an empty preview', () => {
    const wrapper = mount(ImportPreviewStep, {
      props: { preview: { ...preview, samples: [], warnings: [] } },
    })
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Eine Zeile benötigt einen Plan.')
  })
})

describe('ImportResultStep', () => {
  const result: BankImportCommitResult = {
    importId: 'import',
    inserted: 5,
    updated: 2,
    skipped: 1,
    assigned: 6,
    unassigned: 1,
    warnings: ['Eine Zuordnung fehlt.'],
  }

  it('prioritizes loading and failure over a previous successful result', async () => {
    const wrapper = mount(ImportResultStep, {
      props: { result, isLoading: true, error: 'Import fehlgeschlagen' },
    })
    expect(wrapper.text()).toBe('Import wird durchgeführt...')
    await wrapper.setProps({ isLoading: false })
    expect(wrapper.text()).toBe('Import fehlgeschlagen')
    expect(wrapper.text()).not.toContain('Import erfolgreich')
  })

  it('shows committed counts and unresolved assignment warnings', () => {
    const wrapper = mount(ImportResultStep, {
      props: { result, isLoading: false, error: null },
    })
    expect(wrapper.text()).toContain('Import erfolgreich')
    expect(wrapper.findAll('.bg-muted').map((cell) => cell.text())).toEqual([
      '5Eingefügt',
      '2Aktualisiert',
      '1Übersprungen',
      '6Plan zugeordnet',
      '1Ohne Plan',
    ])
    expect(wrapper.text()).toContain('Eine Zuordnung fehlt.')
  })
})
