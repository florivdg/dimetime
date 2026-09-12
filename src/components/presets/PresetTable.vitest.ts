import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { makePreset } from '../../../test/plan-preset-fixtures'
import PresetTable from './PresetTable.vue'

const global = { stubs: { PresetEditDialog: true, PresetApplyDialog: true } }

describe('PresetTable', () => {
  it('sends the requested sort column and the selected preset to the apply dialog', async () => {
    const preset = makePreset()
    const wrapper = mount(PresetTable, {
      props: { presets: [preset], categories: [] },
      global,
    })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Betrag')!
      .trigger('click')
    expect(wrapper.emitted('sort')).toEqual([['amount']])
    await wrapper.get('[title="Anwenden"]').trigger('click')
    const dialog = wrapper.getComponent({ name: 'PresetApplyDialog' })
    expect(dialog.props('preset')).toEqual(preset)
    expect(dialog.props('open')).toBe(true)
    dialog.vm.$emit('applied')
    expect(wrapper.emitted('applied')).toEqual([[]])
  })

  it('only deletes after confirmation and targets the chosen row', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({}))
    const wrapper = mount(PresetTable, {
      props: {
        presets: [makePreset(), makePreset({ id: 'preset-2', name: 'Strom' })],
        categories: [],
      },
      global,
    })
    await wrapper.findAll('[title="Löschen"]')[1]!.trigger('click')
    expect(fetch).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('"Strom" wirklich löschen?')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Löschen')!
      .trigger('click')
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith('/api/presets/preset-2', {
      method: 'DELETE',
    })
    expect(wrapper.emitted('deleted')).toEqual([[]])
  })

  it('reports a failed deletion without emitting deleted', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ error: 'Löschen fehlgeschlagen' }, { status: 500 }),
    )
    const wrapper = mount(PresetTable, {
      props: { presets: [makePreset()], categories: [] },
      global,
    })
    await wrapper.get('[title="Löschen"]').trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Löschen')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.emitted('error')).toEqual([['Löschen fehlgeschlagen']])
    expect(wrapper.emitted('deleted')).toBeUndefined()
  })
})
