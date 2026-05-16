import { vi } from 'vitest'

if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = vi.fn(() =>
    Promise.reject(new Error('fetch not mocked in test')),
  ) as never
}
