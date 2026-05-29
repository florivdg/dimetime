import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

const sessionRef = ref<{
  data: { user: { twoFactorEnabled: boolean } } | null
}>({
  data: { user: { twoFactorEnabled: true } },
})
const generateBackupCodesMock = vi.fn()

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => sessionRef,
    twoFactor: {
      generateBackupCodes: (...args: unknown[]) =>
        generateBackupCodesMock(...args),
    },
  },
}))

const TwoFactorManager = (await import('./TwoFactorManager.vue')).default

describe('TwoFactorManager.vue', () => {
  it('shows "Aktiviert" badge when 2FA enabled', () => {
    sessionRef.value = { data: { user: { twoFactorEnabled: true } } }
    const wrapper = mount(TwoFactorManager)
    expect(wrapper.text()).toContain('Aktiviert')
  })

  it('hides "Aktiviert" badge when 2FA disabled', () => {
    sessionRef.value = { data: { user: { twoFactorEnabled: false } } }
    const wrapper = mount(TwoFactorManager)
    expect(wrapper.text()).not.toContain('Aktiviert')
  })

  it('renders the regenerate button', () => {
    sessionRef.value = { data: { user: { twoFactorEnabled: true } } }
    const wrapper = mount(TwoFactorManager)
    expect(wrapper.text()).toContain('Neue Backup-Codes generieren')
  })
})
