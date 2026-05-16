import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { usePasswordForm } from './usePasswordForm'

function withComposable<T>(setup: () => T): T {
  let captured: T | undefined
  const Comp = defineComponent({
    setup() {
      captured = setup()
      return () => h('div')
    },
  })
  mount(Comp)
  return captured as T
}

describe('usePasswordForm', () => {
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
