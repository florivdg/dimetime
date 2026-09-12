import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
const PresetCreateDialog = (await import('./PresetCreateDialog.vue')).default

describe('PresetCreateDialog', () => {
  it('hydrates transaction values when mounted already open', () => {
    const wrapper = mount(PresetCreateDialog, {
      props: {
        open: true,
        categories: [],
        initialValues: {
          name: 'Gehalt',
          note: null,
          amount: 123456,
          type: 'income',
          categoryId: null,
          isBudget: false,
        },
      },
    })
    expect((wrapper.get('#new-name').element as HTMLInputElement).value).toBe(
      'Gehalt',
    )
    expect(
      (wrapper.get('input[type="number"]').element as HTMLInputElement).value,
    ).toBe('1234.56')
  })

  it('requires a nonblank name', async () => {
    const wrapper = mount(PresetCreateDialog, {
      props: { open: true, categories: [] },
    })
    await wrapper.get('#new-name').setValue('   ')
    await wrapper.get('form').trigger('submit')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('creates a preset from transaction values, preserving cents and transaction type', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({}))
    const wrapper: VueWrapper = mount(PresetCreateDialog, {
      props: {
        open: false,
        categories: [],
        initialValues: {
          name: '  Gehalt  ',
          note: '  Monatlich  ',
          amount: 123456,
          type: 'income',
          categoryId: null,
          isBudget: false,
        },
      },
    })
    await wrapper.setProps({ open: true })
    expect(
      (wrapper.get('input[type="number"]').element as HTMLInputElement).value,
    ).toBe('1234.56')
    await wrapper.get('#new-start-month').setValue('2026-09')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith(
      '/api/presets',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Gehalt',
          note: 'Monatlich',
          amount: 123456,
          type: 'income',
          recurrence: 'monatlich',
          startMonth: '2026-09',
          endDate: null,
          categoryId: null,
          dayOfMonth: null,
          isBudget: false,
        }),
      }),
    )
    expect(wrapper.emitted('created')).toEqual([[]])
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('retains entered data on failure and emits the server message', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ error: 'Name bereits vergeben' }, { status: 409 }),
    )
    const wrapper = mount(PresetCreateDialog, {
      props: { open: true, categories: [] },
    })
    await wrapper.get('#new-name').setValue('Miete')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('error')).toEqual([['Name bereits vergeben']])
    expect(wrapper.emitted('created')).toBeUndefined()
    expect(wrapper.emitted('update:open')).toBeUndefined()
    expect((wrapper.get('#new-name').element as HTMLInputElement).value).toBe(
      'Miete',
    )
  })
})
