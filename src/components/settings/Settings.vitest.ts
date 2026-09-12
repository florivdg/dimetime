import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { useColorMode } from '@vueuse/core'
import { shadcnSelect } from '../../../test/component-mocks'
import UserSettings from './UserSettings.vue'
import ThemeSettings from './ThemeSettings.vue'

vi.mock('@/components/ui/switch', async () => {
  const { shadcnCheckbox } = await import('../../../test/component-mocks')
  return { Switch: shadcnCheckbox.Checkbox }
})
vi.mock('@vueuse/core', async () => {
  const { ref } = await import('vue')
  const store = ref('auto')
  return { useColorMode: () => ({ store }) }
})

const initialSettings = {
  groupTransactionsByType: false,
  themePreference: 'system' as const,
}

const { Select } = shadcnSelect

describe('UserSettings', () => {
  it('sends only the changed setting and disables input while saving', async () => {
    let complete!: (response: Response) => void
    const fetchMock = vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const wrapper = mount(UserSettings, { props: { initialSettings } })
    await wrapper.get('input[type="checkbox"]').setValue(true)
    expect(fetchMock).toHaveBeenCalledWith('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupTransactionsByType: true }),
    })
    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
    complete(
      Response.json({ ...initialSettings, groupTransactionsByType: true }),
    )
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('input').element.checked).toBe(true)
    expect(wrapper.get('input').attributes('disabled')).toBeUndefined()
    expect(initialSettings.groupTransactionsByType).toBe(false)
  })

  it('rolls back failed updates and keeps the control available for retry', async () => {
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(
        Response.json({ error: 'Failed' }, { status: 500 }),
      )
      .mockResolvedValueOnce(
        Response.json({ ...initialSettings, groupTransactionsByType: true }),
      )
    const wrapper = mount(UserSettings, { props: { initialSettings } })
    await wrapper.get('input').setValue(true)
    await flushPromises()
    expect(wrapper.text()).toContain(
      'Einstellung konnte nicht gespeichert werden.',
    )
    expect(wrapper.get<HTMLInputElement>('input').element.checked).toBe(false)
    await wrapper.get('input').setValue(true)
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).not.toContain(
      'Einstellung konnte nicht gespeichert werden.',
    )
    expect(wrapper.get<HTMLInputElement>('input').element.checked).toBe(true)
  })
})

describe('ThemeSettings', () => {
  beforeEach(() => {
    useColorMode().store.value = 'auto'
  })

  it('syncs the server theme on mount and translates auto to system for the API', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({}))
    const wrapper = mount(ThemeSettings, {
      props: {
        initialSettings: { ...initialSettings, themePreference: 'dark' },
      },
    })
    await flushPromises()
    expect(useColorMode().store.value).toBe('dark')
    wrapper.getComponent(Select).vm.$emit('update:modelValue', 'auto')
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themePreference: 'system' }),
    })
    expect(useColorMode().store.value).toBe('auto')
  })

  it('restores the previous theme after network failure and allows a retry', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(Response.json({}))
    const wrapper = mount(ThemeSettings, { props: { initialSettings } })
    wrapper.getComponent(Select).vm.$emit('update:modelValue', 'dark')
    await flushPromises()
    expect(useColorMode().store.value).toBe('auto')
    expect(wrapper.text()).toContain(
      'Einstellung konnte nicht gespeichert werden.',
    )
    wrapper.getComponent(Select).vm.$emit('update:modelValue', 'light')
    await flushPromises()
    expect(useColorMode().store.value).toBe('light')
    expect(wrapper.text()).not.toContain(
      'Einstellung konnte nicht gespeichert werden.',
    )
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
