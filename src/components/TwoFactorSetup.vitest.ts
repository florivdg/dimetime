import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import {
  shadcnButton,
  shadcnCard,
  shadcnForm,
  shadcnInput,
  shadcnInputGroup,
  shadcnPinInput,
} from '@/../test/component-mocks'

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

vi.mock('@/components/ui/button', () => shadcnButton)
vi.mock('@/components/ui/input', () => shadcnInput)
vi.mock('@/components/ui/card', () => shadcnCard)
vi.mock('@/components/ui/form', () => shadcnForm)
vi.mock('@/components/ui/pin-input', () => shadcnPinInput)
vi.mock('@/components/ui/input-group', () => shadcnInputGroup)

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
