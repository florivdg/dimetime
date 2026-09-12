import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PlanCreateDialog from './PlanCreateDialog.vue'

describe('PlanCreateDialog', () => {
  it('requires a date before sending a creation request', async () => {
    const wrapper = mount(PlanCreateDialog, { props: { open: true } })
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBe('')
    await wrapper.get('form').trigger('submit')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('normalizes optional text, sends the chosen calendar date, and closes on success', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}'))
    const wrapper = mount(PlanCreateDialog, { props: { open: true } })
    await wrapper.get('#new-name').setValue('   ')
    await wrapper.get('#new-date').setValue('2026-09-01')
    await wrapper.get('#new-notes').setValue('  Urlaub  ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith('/api/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: null, date: '2026-09-01', notes: 'Urlaub' }),
    })
    expect(wrapper.emitted('created')).toEqual([[]])
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('retains the form and reports the server error for a rejected creation', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Datum ungültig' }), {
        status: 400,
      }),
    )
    const wrapper = mount(PlanCreateDialog, { props: { open: true } })
    await wrapper.get('#new-date').setValue('2026-09-01')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('error')).toEqual([['Datum ungültig']])
    expect(wrapper.emitted('created')).toBeUndefined()
    expect(wrapper.emitted('update:open')).toBeUndefined()
    expect((wrapper.get('#new-date').element as HTMLInputElement).value).toBe(
      '2026-09-01',
    )
    expect(
      wrapper.get('button[type="submit"]').attributes('disabled'),
    ).toBeUndefined()
  })
})
