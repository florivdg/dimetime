import { vi } from 'vitest'
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
  shadcnSelect,
  shadcnTable,
  shadcnTooltip,
} from './component-mocks'

// Globally stub the shadcn-vue / reka-ui wrappers that component tests mount.
// These are pure pass-through stubs, so every `.vitest.ts` file can rely on the
// same stubs without re-declaring the `vi.mock(...)` block. File-specific UI
// modules (sidebar, stepper, pagination, switch, separator, progress) stay
// mocked in their single owning test.
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

if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = vi.fn(() =>
    Promise.reject(new Error('fetch not mocked in test')),
  ) as never
}
