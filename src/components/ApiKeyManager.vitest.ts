import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const listMock = vi.fn()
const createMock = vi.fn()
const deleteMock = vi.fn()

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    apiKey: {
      list: (...args: unknown[]) => listMock(...args),
      create: (...args: unknown[]) => createMock(...args),
      delete: (...args: unknown[]) => deleteMock(...args),
    },
  },
}))

const ApiKeyManager = (await import('./ApiKeyManager.vue')).default

beforeEach(() => {
  listMock.mockReset()
  createMock.mockReset()
  deleteMock.mockReset()
  listMock.mockResolvedValue({ data: { apiKeys: [] }, error: null })
})

describe('ApiKeyManager.vue', () => {
  it('shows the empty state when no keys exist', async () => {
    const wrapper = mount(ApiKeyManager)
    await flushPromises()
    expect(wrapper.text()).toContain('Sie haben noch keine API-Schlüssel')
  })

  it('renders name and starting characters of existing keys', async () => {
    listMock.mockResolvedValue({
      data: {
        apiKeys: [
          {
            id: 'k1',
            name: 'CI-Zugriff',
            start: 'dt_abc',
            createdAt: '2026-03-09T10:00:00.000Z',
          },
        ],
      },
      error: null,
    })
    const wrapper = mount(ApiKeyManager)
    await flushPromises()
    expect(wrapper.text()).toContain('CI-Zugriff')
    expect(wrapper.text()).toContain('dt_abc')
  })

  it('refuses to create a key without a name', async () => {
    const wrapper = mount(ApiKeyManager)
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(createMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Bitte geben Sie einen Namen')
  })

  it('creates a key and reveals the plaintext exactly once', async () => {
    createMock.mockResolvedValue({
      data: { id: 'k1', key: 'dt_plaintextkey' },
      error: null,
    })
    const wrapper = mount(ApiKeyManager, { attachTo: document.body })
    await flushPromises()

    await wrapper.find('input').setValue('Mein Schlüssel')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    await flushPromises()

    expect(createMock).toHaveBeenCalledWith({ name: 'Mein Schlüssel' })
    expect(document.body.textContent).toContain('dt_plaintextkey')
    // Name input is cleared and the list is refreshed after creation.
    expect(listMock).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('surfaces a German error when creation fails', async () => {
    createMock.mockResolvedValue({ data: null, error: { message: 'nope' } })
    const wrapper = mount(ApiKeyManager)
    await flushPromises()

    await wrapper.find('input').setValue('Fehlerschlüssel')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('konnte nicht erstellt werden')
  })

  it('surfaces a German error when the list request fails', async () => {
    listMock.mockResolvedValue({ data: null, error: { message: 'nope' } })
    const wrapper = mount(ApiKeyManager)
    await flushPromises()
    expect(wrapper.text()).toContain('konnten nicht geladen werden')
  })
})
