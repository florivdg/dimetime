import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    twoFactor: {
      verifyTotp: vi.fn(),
      verifyBackupCode: vi.fn(),
    },
  },
}))

vi.mock('@/lib/sync-settings', () => ({
  syncSettingsToLocalStorage: vi.fn().mockResolvedValue(undefined),
}))

const TwoFactorVerify = (await import('./TwoFactorVerify.vue')).default

describe('TwoFactorVerify.vue', () => {
  it('renders TOTP input by default', () => {
    const wrapper = mount(TwoFactorVerify)
    expect(wrapper.text()).toContain(
      'Geben Sie den Code aus Ihrer Authenticator-App',
    )
    expect(wrapper.text()).toContain('Backup-Code verwenden')
  })

  it('switches to backup-code mode when the toggle button is clicked', async () => {
    const wrapper = mount(TwoFactorVerify)
    const switchBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Backup-Code verwenden'))
    expect(switchBtn).toBeDefined()
    await switchBtn?.trigger('click')
    expect(wrapper.text()).toContain('Geben Sie einen Ihrer Backup-Codes ein')
    expect(wrapper.text()).toContain('Authenticator-App verwenden')
  })
})
