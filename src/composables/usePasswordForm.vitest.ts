import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePasswordForm } from './usePasswordForm'
import { withComposable } from '@/../test/composable-helpers'
import { flushPromises } from '@vue/test-utils'

describe('usePasswordForm', () => {
  beforeEach(() => vi.useFakeTimers())

  afterEach(async () => {
    await vi.runAllTimersAsync()
    await flushPromises()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('rejects empty password via schema', () => {
    const { passwordSchema } = withComposable(usePasswordForm)
    const result = passwordSchema.safeParse({ password: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Passwort ist erforderlich')
    }
  })

  it('accepts a non-empty password', () => {
    const { passwordSchema } = withComposable(usePasswordForm)
    const result = passwordSchema.safeParse({ password: 'hunter2' })
    expect(result.success).toBe(true)
  })

  it('exposes a vee-validate form with password initialValue', () => {
    const { passwordForm } = withComposable(usePasswordForm)
    expect(passwordForm.values.password).toBe('')
  })
})
