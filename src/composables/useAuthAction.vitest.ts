import { describe, expect, it } from 'vitest'
import { useAuthAction } from './useAuthAction'
import { withComposable } from '@/../test/composable-helpers'

describe('useAuthAction', () => {
  it('returns data on success and clears errorMessage', async () => {
    const auth = withComposable(useAuthAction)
    auth.errorMessage.value = 'old'
    const result = await auth.runWithErrorHandling(
      async () => ({ data: { token: 'abc' } }),
      { default: 'oops' },
    )
    expect(result).toEqual({ token: 'abc' })
    expect(auth.errorMessage.value).toBeNull()
    expect(auth.isLoading.value).toBe(false)
  })

  it('maps error.status to a message', async () => {
    const auth = withComposable(useAuthAction)
    const result = await auth.runWithErrorHandling(
      async () => ({ error: { status: 400, message: 'ignored' } }),
      { 400: 'Bad input', default: 'fallback' },
    )
    expect(result).toBeNull()
    expect(auth.errorMessage.value).toBe('Bad input')
  })

  it('falls back to default when no status mapping exists', async () => {
    const auth = withComposable(useAuthAction)
    const result = await auth.runWithErrorHandling(
      async () => ({ error: { status: 999 } }),
      { default: 'fallback' },
    )
    expect(result).toBeNull()
    expect(auth.errorMessage.value).toBe('fallback')
  })

  it('uses network message on thrown error', async () => {
    const auth = withComposable(useAuthAction)
    const result = await auth.runWithErrorHandling(
      async () => {
        throw new Error('boom')
      },
      { network: 'No connection', default: 'fallback' },
    )
    expect(result).toBeNull()
    expect(auth.errorMessage.value).toBe('No connection')
  })

  it('toggles isLoading during the action', async () => {
    const auth = withComposable(useAuthAction)
    let captured = false
    const promise = auth.runWithErrorHandling(async () => {
      captured = auth.isLoading.value
      return { data: 'ok' }
    }, {})
    expect(auth.isLoading.value).toBe(true)
    await promise
    expect(captured).toBe(true)
    expect(auth.isLoading.value).toBe(false)
  })

  it('returns null when no data and no error', async () => {
    const auth = withComposable(useAuthAction)
    const result = await auth.runWithErrorHandling(async () => ({}), {})
    expect(result).toBeNull()
  })
})
