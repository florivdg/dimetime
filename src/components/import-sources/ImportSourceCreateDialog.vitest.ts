import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, Fragment, h } from 'vue'

const { mutateJson } = vi.hoisted(() => ({ mutateJson: vi.fn() }))

vi.mock('@/lib/http', () => ({ mutateJson }))
vi.mock('@/components/ui/select', () => ({
  Select: defineComponent({
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup:
      (props, { emit, slots }) =>
      () =>
        h(
          'select',
          {
            class: 'select-stub',
            value: props.modelValue,
            onChange: (event: Event) =>
              emit(
                'update:modelValue',
                (event.target as HTMLSelectElement).value,
              ),
          },
          slots.default?.(),
        ),
  }),
  SelectContent: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h(Fragment, {}, slots.default?.()),
  }),
  SelectItem: defineComponent({
    props: ['value'],
    setup:
      (props, { slots }) =>
      () =>
        h('option', { value: props.value }, slots.default?.()),
  }),
  SelectTrigger: defineComponent({ setup: () => () => null }),
  SelectValue: defineComponent({ setup: () => () => null }),
}))
vi.mock('@/components/ui/switch', () => ({
  Switch: defineComponent({
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup:
      (props, { emit }) =>
      () =>
        h('input', {
          id: 'create-active',
          type: 'checkbox',
          checked: props.modelValue,
          onChange: (event: Event) =>
            emit(
              'update:modelValue',
              (event.target as HTMLInputElement).checked,
            ),
        }),
  }),
}))

const ImportSourceCreateDialog = (
  await import('./ImportSourceCreateDialog.vue')
).default

describe('ImportSourceCreateDialog.vue', () => {
  beforeEach(() => mutateJson.mockReset())

  it('submits selected values and the modelValue-backed active state', async () => {
    mutateJson.mockImplementationOnce(
      async (options: { onSuccess: () => void }) => options.onSuccess(),
    )
    const wrapper = mount(ImportSourceCreateDialog, {
      props: {
        open: true,
        importTypes: [
          {
            preset: 'ing_csv_v1',
            name: 'ING CSV',
            extensions: ['csv'],
            requiredColumns: ['Buchung'],
          },
        ],
      },
    })

    await wrapper.get('#create-name').setValue(' Girokonto ')
    const selects = wrapper.findAll('select')
    await selects[0]!.setValue('ing_csv_v1')
    await selects[1]!.setValue('bank_account')
    await wrapper.get('#create-active').setValue(false)
    await wrapper.get('form').trigger('submit')

    expect(mutateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/import-sources',
        method: 'POST',
        body: {
          name: 'Girokonto',
          preset: 'ing_csv_v1',
          sourceKind: 'bank_account',
          bankName: null,
          accountLabel: null,
          accountIdentifier: null,
          defaultPlanAssignment: 'auto_month',
          isActive: false,
        },
      }),
    )
    expect(wrapper.emitted('created')).toHaveLength(1)
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('keeps submission disabled until required fields are selected', () => {
    const wrapper = mount(ImportSourceCreateDialog, {
      props: { open: true, importTypes: [] },
    })

    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBe('')
    expect(mutateJson).not.toHaveBeenCalled()
  })
})
