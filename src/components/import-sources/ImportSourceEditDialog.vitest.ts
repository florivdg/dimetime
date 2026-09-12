import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

const { mutateJson } = vi.hoisted(() => ({ mutateJson: vi.fn() }))

vi.mock('@/lib/http', () => ({ mutateJson }))
vi.mock('@/components/ui/switch', () => ({
  Switch: defineComponent({
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup:
      (props, { emit }) =>
      () =>
        h('input', {
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

const ImportSourceEditDialog = (await import('./ImportSourceEditDialog.vue'))
  .default

const source = {
  id: 'src-1',
  name: 'ING Main',
  preset: 'ing_csv_v1' as const,
  sourceKind: 'bank_account' as const,
  bankName: null,
  accountLabel: null,
  accountIdentifier: null,
  defaultPlanAssignment: 'auto_month' as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('ImportSourceEditDialog.vue', () => {
  beforeEach(() => mutateJson.mockReset())

  it('submits edited values using the modelValue switch contract', async () => {
    mutateJson.mockImplementationOnce(
      async (options: { onSuccess: () => void }) => options.onSuccess(),
    )
    const wrapper = mount(ImportSourceEditDialog, {
      props: { open: true, source, importTypes: [] },
    })

    expect((wrapper.get('#edit-name').element as HTMLInputElement).value).toBe(
      'ING Main',
    )
    const activeSwitch = wrapper.get('input[type="checkbox"]')
    expect((activeSwitch.element as HTMLInputElement).checked).toBe(true)
    await activeSwitch.setValue(false)
    await wrapper.get('#edit-bank').setValue(' ING ')
    await wrapper.get('form').trigger('submit')

    expect(mutateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/import-sources/src-1',
        method: 'PUT',
        body: {
          name: 'ING Main',
          preset: 'ing_csv_v1',
          sourceKind: 'bank_account',
          bankName: 'ING',
          accountLabel: null,
          accountIdentifier: null,
          defaultPlanAssignment: 'auto_month',
          isActive: false,
        },
      }),
    )
    expect(wrapper.emitted('updated')).toHaveLength(1)
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('does not submit without a selected source', async () => {
    const wrapper = mount(ImportSourceEditDialog, {
      props: { open: true, source: null, importTypes: [] },
    })

    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBe('')
    await wrapper.get('form').trigger('submit')
    expect(mutateJson).not.toHaveBeenCalled()
  })
})
