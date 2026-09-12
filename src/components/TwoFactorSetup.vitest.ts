import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    twoFactor: {
      enable: vi.fn(),
      verifyTotp: vi.fn(),
    },
  },
}))

vi.mock('@lowlighter/qrcode', () => ({
  qrcode: () => '<svg></svg>',
}))

const TwoFactorSetup = (await import('./TwoFactorSetup.vue')).default

describe('TwoFactorSetup.vue', () => {
  beforeEach(() => vi.useFakeTimers())

  afterEach(async () => {
    await vi.runAllTimersAsync()
    await flushPromises()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('starts on the password step', () => {
    const wrapper = mount(TwoFactorSetup)
    expect(wrapper.text()).toContain('Passwort')
  })

  it('renders the heading', () => {
    const wrapper = mount(TwoFactorSetup)
    expect(wrapper.text()).toContain('Zwei-Faktor-Authentifizierung')
  })
})
