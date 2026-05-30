import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import TwoFactorBackupCodes from './TwoFactorBackupCodes.vue'

let writeTextMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  writeTextMock = vi.fn(() => Promise.resolve())
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    value: { writeText: writeTextMock },
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('TwoFactorBackupCodes.vue', () => {
  it('renders all codes', () => {
    const wrapper = mount(TwoFactorBackupCodes, {
      props: {
        codes: ['111-222', '333-444', '555-666'],
        warningText: 'Save these!',
      },
    })
    expect(wrapper.text()).toContain('111-222')
    expect(wrapper.text()).toContain('333-444')
    expect(wrapper.text()).toContain('555-666')
    expect(wrapper.text()).toContain('Save these!')
  })

  it('copies a single code on per-row click', async () => {
    const wrapper = mount(TwoFactorBackupCodes, {
      props: {
        codes: ['code-a', 'code-b'],
        warningText: 'w',
      },
    })
    // Per-row buttons are the first N buttons; the last is "Alle Codes kopieren"
    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click')
    expect(writeTextMock).toHaveBeenCalledWith('code-a')
  })

  it('copies all codes joined by newline on bulk button click', async () => {
    const wrapper = mount(TwoFactorBackupCodes, {
      props: {
        codes: ['c1', 'c2', 'c3'],
        warningText: 'w',
      },
    })
    const buttons = wrapper.findAll('button')
    await buttons[buttons.length - 1].trigger('click')
    expect(writeTextMock).toHaveBeenCalledWith('c1\nc2\nc3')
  })

  it('renders default slot content', () => {
    const wrapper = mount(TwoFactorBackupCodes, {
      props: { codes: ['a'], warningText: 'w' },
      slots: { default: '<span class="slot-marker">DONE</span>' },
    })
    expect(wrapper.html()).toContain('slot-marker')
  })
})
