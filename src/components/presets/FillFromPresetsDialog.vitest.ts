import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { makePreset } from '../../../test/plan-preset-fixtures'
const FillFromPresetsDialog = (await import('./FillFromPresetsDialog.vue'))
  .default

vi.mock('vue-sonner', () => ({ toast: { success: vi.fn() } }))

async function openDialog() {
  const wrapper: VueWrapper = mount(FillFromPresetsDialog, {
    props: { open: false, planId: 'plan-1', planDate: '2026-09-01' },
  })
  await wrapper.setProps({ open: true })
  await flushPromises()
  return wrapper
}

describe('FillFromPresetsDialog', () => {
  it('loads matching presets when mounted already open', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ presets: [{ ...makePreset(), isMatching: true }] }),
    )
    const wrapper = mount(FillFromPresetsDialog, {
      props: { open: true, planId: 'plan-1', planDate: '2026-09-01' },
    })
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith('/api/plans/plan-1/matching-presets')
    expect(wrapper.text()).toContain('1 von 1 ausgewählt')
  })

  it('preselects matching presets and submits only the user-selected presets', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        Response.json({
          presets: [
            { ...makePreset(), isMatching: true },
            {
              ...makePreset({ id: 'preset-2', name: 'Versicherung' }),
              isMatching: false,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(Response.json({ count: 1 }))
    const wrapper = await openDialog()
    expect(fetch).toHaveBeenCalledWith('/api/plans/plan-1/matching-presets')
    expect(wrapper.text()).toContain('1 von 2 ausgewählt')
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect((checkboxes[0]!.element as HTMLInputElement).checked).toBe(true)
    expect((checkboxes[1]!.element as HTMLInputElement).checked).toBe(false)
    await checkboxes[0]!.setValue(false)
    await checkboxes[1]!.setValue(true)
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('1 Vorlagen anwenden'))!
      .trigger('click')
    await flushPromises()
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/presets/bulk-apply',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ planId: 'plan-1', presetIds: ['preset-2'] }),
      }),
    )
    expect(wrapper.emitted('applied')).toEqual([[1]])
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('disables apply after clearing the selection and can select all', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ presets: [{ ...makePreset(), isMatching: true }] }),
    )
    const wrapper = await openDialog()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Auswahl aufheben')!
      .trigger('click')
    expect(wrapper.text()).toContain('0 von 1 ausgewählt')
    const apply = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Vorlagen anwenden'))!
    expect(apply.attributes('disabled')).toBe('')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Alle auswählen')!
      .trigger('click')
    expect(wrapper.text()).toContain('1 von 1 ausgewählt')
    expect(apply.attributes('disabled')).toBeUndefined()
  })

  it('clears stale selections when reopening fails to load', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        Response.json({ presets: [{ ...makePreset(), isMatching: true }] }),
      )
      .mockRejectedValueOnce(new Error('offline'))
    const wrapper = await openDialog()
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(wrapper.emitted('error')).toEqual([
      ['Vorlagen konnten nicht geladen werden.'],
    ])
    expect(wrapper.text()).toContain('Keine aktiven Vorlagen vorhanden.')
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    expect(wrapper.emitted('applied')).toBeUndefined()
  })
})
