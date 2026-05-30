import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useAuthAction } from './useAuthAction'
import { useTwoFactorVerify } from './useTwoFactorVerify'

const verifyTotpMock = vi.fn()

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    twoFactor: {
      verifyTotp: (...args: unknown[]) => verifyTotpMock(...args),
    },
  },
}))

interface VerifyResult {
  totpCode: { value: string[] }
  verifyTotp: () => Promise<void>
  handlePinComplete: (value: string[]) => void
  errorMessage: { value: string | null }
  isLoading: { value: boolean }
}

function setupWith(onSuccess: () => void | Promise<void>): VerifyResult {
  let captured: VerifyResult | undefined
  const Comp = defineComponent({
    setup() {
      const auth = useAuthAction()
      const verify = useTwoFactorVerify(auth, onSuccess)
      captured = {
        ...verify,
        errorMessage: auth.errorMessage,
        isLoading: auth.isLoading,
      } as VerifyResult
      return () => h('div')
    },
  })
  mount(Comp)
  return captured as VerifyResult
}

describe('useTwoFactorVerify', () => {
  it('rejects codes shorter than 6 digits with an error message', async () => {
    verifyTotpMock.mockReset()
    const verify = setupWith(() => undefined)
    verify.totpCode.value = ['1', '2', '3']
    await verify.verifyTotp()
    expect(verifyTotpMock).not.toHaveBeenCalled()
    expect(verify.errorMessage.value).toBe(
      'Bitte geben Sie einen 6-stelligen Code ein',
    )
  })

  it('invokes onSuccess when verification returns data', async () => {
    verifyTotpMock.mockReset()
    verifyTotpMock.mockResolvedValueOnce({ data: { ok: true } })
    let called = false
    const verify = setupWith(() => {
      called = true
    })
    verify.totpCode.value = ['1', '2', '3', '4', '5', '6']
    await verify.verifyTotp()
    expect(verifyTotpMock).toHaveBeenCalledWith({
      code: '123456',
      trustDevice: true,
    })
    expect(called).toBe(true)
  })

  it('clears totpCode when the API rejects with an invalid-code error', async () => {
    verifyTotpMock.mockReset()
    verifyTotpMock.mockResolvedValueOnce({ error: { status: 400 } })
    const verify = setupWith(() => undefined)
    verify.totpCode.value = ['1', '2', '3', '4', '5', '6']
    await verify.verifyTotp()
    expect(verify.totpCode.value).toEqual([])
  })

  it('handlePinComplete auto-fires verify when value is 6 digits', async () => {
    verifyTotpMock.mockReset()
    verifyTotpMock.mockResolvedValueOnce({ data: { ok: true } })
    let onSuccessCalled = false
    const verify = setupWith(() => {
      onSuccessCalled = true
    })
    verify.handlePinComplete(['1', '2', '3', '4', '5', '6'])
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    expect(verify.totpCode.value).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(onSuccessCalled).toBe(true)
  })

  it('handlePinComplete does not fire when value is incomplete', () => {
    verifyTotpMock.mockReset()
    const verify = setupWith(() => undefined)
    verify.handlePinComplete(['1', '2'])
    expect(verifyTotpMock).not.toHaveBeenCalled()
  })
})
