import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('vue-sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}))
vi.mock('@/components/ui/stepper', () => ({
  Stepper: defineComponent({
    setup(_, { slots }) {
      return () => h('div', {}, slots.default?.())
    },
  }),
  StepperItem: defineComponent({
    setup(_, { slots }) {
      return () => h('div', {}, slots.default?.({ state: 'inactive' }))
    },
  }),
  StepperSeparator: defineComponent({ setup: () => () => h('div') }),
  StepperTrigger: defineComponent({
    setup(_, { slots }) {
      return () => h('div', {}, slots.default?.())
    },
  }),
}))
vi.mock('./ImportSourceStep.vue', () => ({
  default: defineComponent({
    props: ['sources'],
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () =>
        h(
          'button',
          {
            'data-testid': 'choose-source',
            onClick: () => emit('update:modelValue', props.sources[0]?.id),
          },
          'Quelle wählen',
        )
    },
  }),
}))
vi.mock('./ImportFileStep.vue', () => ({
  default: defineComponent({
    props: ['importTypes'],
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-testid': 'file-step' }, [
          h('span', props.importTypes[0]?.name),
          h(
            'button',
            {
              'data-testid': 'choose-file',
              onClick: () =>
                emit('update:modelValue', new File(['csv'], 'bank.csv')),
            },
            'Datei wählen',
          ),
        ])
    },
  }),
}))
vi.mock('./ImportPreviewStep.vue', () => ({
  default: defineComponent({
    props: ['preview'],
    setup: (props) => () =>
      h('div', { 'data-testid': 'preview-step' }, props.preview.marker),
  }),
}))
vi.mock('./ImportResultStep.vue', () => ({
  default: defineComponent({
    props: ['result'],
    setup: (props) => () =>
      h('div', { 'data-testid': 'result-step' }, props.result?.inserted),
  }),
}))

const BankImportDialog = (await import('./BankImportDialog.vue')).default

const source = {
  id: 'src-1',
  name: 'Girokonto',
  preset: 'ing_csv_v1' as const,
  sourceKind: 'bank_account' as const,
  bankName: 'ING',
  accountLabel: null,
  accountIdentifier: null,
  defaultPlanAssignment: 'auto_month' as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('BankImportDialog.vue', () => {
  beforeEach(() => {
    toastError.mockReset()
    toastSuccess.mockReset()
  })

  it('loads import types when initially opened and completes the workflow', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          importTypes: [{ preset: 'ing_csv_v1', name: 'ING CSV' }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ marker: 'Vorschau bereit' }))
      .mockResolvedValueOnce(jsonResponse({ inserted: 2, updated: 1 }))
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(BankImportDialog, {
      props: { open: true, sources: [source] },
    })
    await flushPromises()

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/import-types')
    await wrapper.get('[data-testid="choose-source"]').trigger('click')
    expect(wrapper.get('[data-testid="file-step"]').text()).toContain('ING CSV')

    await wrapper.get('[data-testid="choose-file"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="preview-step"]').text()).toBe(
      'Vorschau bereit',
    )

    const previewCall = fetchMock.mock.calls[1]
    expect(previewCall?.[0]).toBe('/api/bank-imports/preview')
    expect(previewCall?.[1]).toEqual(
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    )
    const previewBody = previewCall?.[1]?.body as FormData
    expect(previewBody.get('sourceId')).toBe('src-1')
    expect((previewBody.get('file') as File).name).toBe('bank.csv')

    const commitButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Import bestätigen'))
    expect(commitButton).toBeDefined()
    await commitButton!.trigger('click')
    await flushPromises()

    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/bank-imports/commit')
    expect(wrapper.emitted('imported')).toHaveLength(1)
    expect(toastSuccess).toHaveBeenCalledWith(
      'Import erfolgreich: 2 eingefügt, 1 aktualisiert',
    )
    expect(wrapper.get('[data-testid="result-step"]').text()).toBe('2')
  })

  it('reports an import-type loading error from the initial open state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'kaputt' }, 500)),
    )

    mount(BankImportDialog, { props: { open: true, sources: [] } })
    await flushPromises()

    expect(toastError).toHaveBeenCalledWith(
      'Fehler beim Laden der Import-Typen',
    )
  })
})
