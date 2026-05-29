import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

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
  it('starts on the password step', () => {
    const wrapper = mount(TwoFactorSetup)
    expect(wrapper.text()).toContain('Passwort')
  })

  it('renders the heading', () => {
    const wrapper = mount(TwoFactorSetup)
    expect(wrapper.text()).toContain('Zwei-Faktor-Authentifizierung')
  })
})
