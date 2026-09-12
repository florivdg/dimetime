import { afterEach, beforeEach, vi } from 'vitest'
import { enableAutoUnmount } from '@vue/test-utils'
import {
  shadcnAlertDialog,
  shadcnButton,
  shadcnCard,
  shadcnCheckbox,
  shadcnDialog,
  shadcnDropdownMenu,
  shadcnForm,
  shadcnInput,
  shadcnInputGroup,
  shadcnLabel,
  shadcnPinInput,
  shadcnProgress,
  shadcnSelect,
  shadcnTable,
  shadcnTooltip,
} from './component-mocks'

// Vue deliberately avoids its delayed devtools probe in emulated DOMs whose
// user agent identifies them as jsdom. happy-dom needs the same treatment so
// every mounted wrapper does not leave a three-second timer behind.
Object.defineProperty(window.navigator, 'userAgent', {
  configurable: true,
  value: `${window.navigator.userAgent} jsdom`,
})

// Globally stub the shadcn-vue / reka-ui wrappers that component tests mount.
// These are pure pass-through stubs, so every `.vitest.ts` file can rely on the
// same stubs without re-declaring the `vi.mock(...)` block. File-specific UI
// modules (sidebar, stepper, pagination, switch, separator) stay mocked in
// their single owning test.
vi.mock('@/components/ui/button', () => shadcnButton)
vi.mock('@/components/ui/input', () => shadcnInput)
vi.mock('@/components/ui/select', () => shadcnSelect)
vi.mock('@/components/ui/table', () => shadcnTable)
vi.mock('@/components/ui/card', () => shadcnCard)
vi.mock('@/components/ui/form', () => shadcnForm)
vi.mock('@/components/ui/dialog', () => shadcnDialog)
vi.mock('@/components/ui/alert-dialog', () => shadcnAlertDialog)
vi.mock('@/components/ui/dropdown-menu', () => shadcnDropdownMenu)
vi.mock('@/components/ui/tooltip', () => shadcnTooltip)
vi.mock('@/components/ui/input-group', () => shadcnInputGroup)
vi.mock('@/components/ui/pin-input', () => shadcnPinInput)
vi.mock('@/components/ui/label', () => shadcnLabel)
vi.mock('@/components/ui/checkbox', () => shadcnCheckbox)
vi.mock('@/components/ui/progress', () => shadcnProgress)

enableAutoUnmount(afterEach)

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('fetch not mocked in test'))),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})
