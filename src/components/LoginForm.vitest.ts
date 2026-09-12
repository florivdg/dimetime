import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { authClient } from '@/lib/auth-client'
import { syncSettingsToLocalStorage } from '@/lib/sync-settings'
import LoginForm from './LoginForm.vue'

vi.mock('@/lib/auth-client', () => ({
  authClient: { signIn: { email: vi.fn(), passkey: vi.fn() } },
}))
vi.mock('@/lib/sync-settings', () => ({ syncSettingsToLocalStorage: vi.fn() }))

const initialUrl = window.location.href

beforeEach(() => {
  vi.mocked(authClient.signIn.email).mockReset()
  vi.mocked(authClient.signIn.passkey).mockReset()
  vi.mocked(syncSettingsToLocalStorage).mockReset()
  vi.stubGlobal('PublicKeyCredential', undefined)
})

afterEach(() => {
  window.location.href = initialUrl
})

describe('LoginForm', () => {
  it('does not authenticate invalid form values', async () => {
    const wrapper = mount(LoginForm)
    await wrapper.get('input[type="email"]').setValue('invalid')
    await wrapper.get('input[type="password"]').setValue('short')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(authClient.signIn.email).not.toHaveBeenCalled()
    expect(syncSettingsToLocalStorage).not.toHaveBeenCalled()
  })

  it('passes credentials to authentication and displays invalid-credential errors', async () => {
    vi.mocked(authClient.signIn.email).mockImplementation(
      async (_credentials, options) => {
        await options?.onError?.({ error: { status: 401 } } as Parameters<
          NonNullable<NonNullable<typeof options>['onError']>
        >[0])
        return {
          data: null,
          error: {
            message: 'Unauthorized',
            status: 401,
            statusText: 'Unauthorized',
          },
        }
      },
    )
    const wrapper = mount(LoginForm)
    await wrapper.get('input[type="email"]').setValue('person@example.com')
    await wrapper
      .get('input[type="password"]')
      .setValue('sixteen-character-password')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() =>
      expect(authClient.signIn.email).toHaveBeenCalledTimes(1),
    )
    await flushPromises()
    expect(authClient.signIn.email).toHaveBeenCalledWith(
      {
        email: 'person@example.com',
        password: 'sixteen-character-password',
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    )
    expect(wrapper.text()).toContain('Ungültige Anmeldedaten')
    expect(
      wrapper.get('button[type="submit"]').attributes('disabled'),
    ).toBeUndefined()
    expect(syncSettingsToLocalStorage).not.toHaveBeenCalled()
  })

  it('synchronizes settings after successful login and rejects an external redirect', async () => {
    const wrapper = mount(LoginForm, {
      props: { redirectTo: 'https://evil.example/steal' },
    })
    await wrapper.get('input[type="email"]').setValue('person@example.com')
    await wrapper
      .get('input[type="password"]')
      .setValue('sixteen-character-password')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() =>
      expect(authClient.signIn.email).toHaveBeenCalledTimes(1),
    )
    const options = vi.mocked(authClient.signIn.email).mock.calls[0]![1]!
    await options.onSuccess?.(
      {} as Parameters<NonNullable<typeof options.onSuccess>>[0],
    )
    expect(syncSettingsToLocalStorage).toHaveBeenCalledTimes(1)
    expect(new URL(window.location.href).pathname).toBe('/')
    expect(new URL(window.location.href).origin).toBe(
      new URL(initialUrl).origin,
    )
  })

  it('recovers from a rejected passkey request so the user can retry', async () => {
    vi.mocked(authClient.signIn.passkey).mockRejectedValue(
      new Error('User canceled'),
    )
    const wrapper = mount(LoginForm)
    const passkey = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Mit Passkey anmelden')!
    await passkey.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Passkey-Anmeldung fehlgeschlagen.')
    expect(passkey.attributes('disabled')).toBeUndefined()
    await passkey.trigger('click')
    await flushPromises()
    expect(authClient.signIn.passkey).toHaveBeenCalledTimes(2)
    expect(syncSettingsToLocalStorage).not.toHaveBeenCalled()
  })
})
