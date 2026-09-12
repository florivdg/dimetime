import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { makePlan } from '../../../test/plan-preset-fixtures'
import PlanTable from './PlanTable.vue'

const props = { plans: [makePlan()], isLoading: false, searchQuery: '' }

describe('PlanTable', () => {
  it('distinguishes no plans from a search without matches', async () => {
    const wrapper = mount(PlanTable, { props: { ...props, plans: [] } })
    expect(wrapper.text()).toContain('Sie haben noch keine Pläne erstellt.')
    await wrapper.setProps({ searchQuery: 'Urlaub' })
    expect(wrapper.text()).toContain('Keine Pläne gefunden für "Urlaub".')
    expect(wrapper.text()).not.toContain('noch keine Pläne')
  })

  it('saves edited text and archive status, then returns to the plan link', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}'))
    const wrapper = mount(PlanTable, { props })
    await wrapper.get('[title="Bearbeiten"]').trigger('click')
    await wrapper.get('input[placeholder="Planname..."]').setValue('  Urlaub  ')
    await wrapper.get('input[placeholder="Notizen..."]').setValue('   ')
    await wrapper.get('#archived-plan-1').setValue(true)
    await wrapper.get('[title="Speichern"]').trigger('click')
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith(
      '/api/plans/plan-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          name: 'Urlaub',
          date: '2026-09-01',
          notes: null,
          isArchived: true,
        }),
      }),
    )
    expect(wrapper.emitted('updated')).toEqual([[]])
    expect(wrapper.find('input[placeholder="Planname..."]').exists()).toBe(
      false,
    )
    expect(wrapper.get('a').attributes('href')).toBe('/plans/plan-1')
  })

  it('cancels edits without a request', async () => {
    const wrapper = mount(PlanTable, { props })
    await wrapper.get('[title="Bearbeiten"]').trigger('click')
    await wrapper.get('input[placeholder="Planname..."]').setValue('Verworfen')
    await wrapper.get('[title="Abbrechen"]').trigger('click')
    expect(fetch).not.toHaveBeenCalled()
    expect(wrapper.get('a').text()).toBe('September')
  })

  it('requires the deletion confirmation before Enter can delete the selected plan', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}'))
    const wrapper = mount(PlanTable, { props })
    await wrapper.get('[title="Löschen"]').trigger('click')
    await wrapper.get('#delete-confirmation').setValue('nein')
    await wrapper.get('#delete-confirmation').trigger('keyup.enter')
    expect(fetch).not.toHaveBeenCalled()
    await wrapper.get('#delete-confirmation').setValue('löschen')
    await wrapper.get('#delete-confirmation').trigger('keyup.enter')
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith(
      '/api/plans/plan-1',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(wrapper.emitted('deleted')).toEqual([[]])
  })
})
