import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { shadcnSelect } from '../../../test/component-mocks'
import { makePlan, makePreset } from '../../../test/plan-preset-fixtures'
const PresetApplyDialog = (await import('./PresetApplyDialog.vue')).default

vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

async function openDialog() {
  const wrapper: VueWrapper = mount(PresetApplyDialog, {
    props: { open: false, preset: makePreset() },
  })
  await wrapper.setProps({ open: true })
  await flushPromises()
  return wrapper
}

describe('PresetApplyDialog', () => {
  it('loads plans when mounted already open', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ plans: [makePlan()] }),
    )
    const wrapper = mount(PresetApplyDialog, {
      props: { open: true, preset: makePreset() },
    })
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith('/api/plans')
    expect(wrapper.findAllComponents(shadcnSelect.SelectItem)).toHaveLength(1)
  })

  it('only offers active plans and submits the selected plan and due date', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        Response.json({
          plans: [makePlan(), makePlan({ id: 'archived', isArchived: true })],
        }),
      )
      .mockResolvedValueOnce(Response.json({}))
    const wrapper = await openDialog()
    expect(
      wrapper
        .findAllComponents(shadcnSelect.SelectItem)
        .map((item) => item.attributes('value')),
    ).toEqual(['plan-1'])
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBe('')
    wrapper
      .getComponent(shadcnSelect.Select)
      .vm.$emit('update:modelValue', 'plan-1')
    await wrapper.get('#due-date').setValue('2026-09-15')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/presets/preset-1/apply',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ planId: 'plan-1', dueDate: '2026-09-15' }),
      }),
    )
    expect(wrapper.emitted('applied')).toEqual([[]])
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('prevents applying when there are no active plans', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ plans: [] }))
    const wrapper = await openDialog()
    expect(wrapper.text()).toContain('Keine aktiven Pläne verfügbar')
    await wrapper.get('form').trigger('submit')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('applied')).toBeUndefined()
  })

  it('reports a rejected apply without closing or announcing success', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ plans: [makePlan()] }))
      .mockResolvedValueOnce(
        Response.json({ error: 'Plan ist archiviert' }, { status: 400 }),
      )
    const wrapper = await openDialog()
    wrapper
      .getComponent(shadcnSelect.Select)
      .vm.$emit('update:modelValue', 'plan-1')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('error')).toEqual([['Plan ist archiviert']])
    expect(wrapper.emitted('applied')).toBeUndefined()
    expect(wrapper.emitted('update:open')).toBeUndefined()
  })
})
