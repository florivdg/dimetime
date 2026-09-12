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

const PresetEditDialog = (await import('./PresetEditDialog.vue')).default

const samplePreset = {
  id: 'p-1',
  name: 'Rent',
  note: null,
  type: 'expense' as const,
  amount: 100000,
  recurrence: 'monatlich' as const,
  startMonth: '2026-01',
  endDate: null,
  categoryId: null,
  dayOfMonth: null,
  isBudget: false,
  userId: 'u-1',
  lastUsedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  categoryName: null,
  categoryColor: null,
}

describe('PresetEditDialog.vue', () => {
  beforeEach(() => mutateJson.mockReset())

  it('submits the hydrated preset and reports a successful update', async () => {
    mutateJson.mockImplementationOnce(
      async (options: { onSuccess: () => void }) => options.onSuccess(),
    )
    const wrapper = mount(PresetEditDialog, {
      props: { open: true, preset: samplePreset, categories: [] },
    })

    expect((wrapper.get('#edit-name').element as HTMLInputElement).value).toBe(
      'Rent',
    )
    await wrapper.get('form').trigger('submit')

    expect(mutateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/presets/p-1',
        method: 'PUT',
        body: {
          name: 'Rent',
          note: null,
          amount: 100000,
          type: 'expense',
          recurrence: 'monatlich',
          startMonth: '2026-01',
          endDate: null,
          categoryId: null,
          dayOfMonth: null,
          isBudget: false,
        },
      }),
    )
    expect(wrapper.emitted('updated')).toHaveLength(1)
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('does not submit when no preset is selected', async () => {
    const wrapper = mount(PresetEditDialog, {
      props: { open: true, preset: null, categories: [] },
    })

    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBe('')
    await wrapper.get('form').trigger('submit')
    expect(mutateJson).not.toHaveBeenCalled()
  })
})
