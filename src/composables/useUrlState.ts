import { reactive, watch, onMounted, computed, onUnmounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'

// Field type definitions
type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'nullable-string'
  | 'nullable-boolean'
  | 'nullable-enum'

interface FieldConfig<T> {
  type: FieldType
  default: T
  urlKey?: string // Custom URL key (defaults to field name)
  debounce?: number // Debounce delay in ms for this field
  enumValues?: readonly T[] // Required for enum types
}

type SchemaConfig<T> = {
  [K in keyof T]: FieldConfig<T[K]>
}

interface UseUrlStateOptions {
  debounce?: number // Global debounce for URL updates (default: 0)
}

interface UseUrlStateReturn<T> {
  state: T
  reset: () => void
  hasActiveParams: { value: boolean }
}

// Serialization helpers
function serializeValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return null
}

function deserializeValue<T>(value: string | null, config: FieldConfig<T>): T {
  if (value === null || value === '') {
    return config.default
  }

  switch (config.type) {
    case 'string':
      return value as T

    case 'number': {
      const num = Number(value)
      return (isNaN(num) ? config.default : num) as T
    }

    case 'boolean':
      return (value === 'true') as T

    case 'nullable-boolean':
      if (value === 'true') return true as T
      if (value === 'false') return false as T
      return null as T

    case 'enum':
    case 'nullable-enum':
      if (config.enumValues?.includes(value as T)) {
        return value as T
      }
      return config.default

    case 'nullable-string':
      return (value || null) as T

    default:
      return config.default
  }
}

export function useUrlState<T extends Record<string, unknown>>(
  schema: SchemaConfig<T>,
  options: UseUrlStateOptions = {},
): UseUrlStateReturn<T> {
  const { debounce: globalDebounce = 0 } = options

  // Build defaults object
  const defaults = Object.fromEntries(
    Object.entries(schema).map(([key, config]) => [
      key,
      (config as FieldConfig<unknown>).default,
    ]),
  ) as T

  // Initialize state with defaults (SSR-safe) - use reactive for direct property access
  // Cast to T to allow direct property access while maintaining reactivity
  const state = reactive({ ...defaults }) as T

  // Flags to prevent infinite loops
  let isUpdatingFromUrl = false

  // Track if we're in browser environment
  const isBrowser = typeof window !== 'undefined'

  // Build URL key mapping
  const urlKeyMap = new Map<string, keyof T>()
  for (const [key, config] of Object.entries(schema)) {
    const urlKey = (config as FieldConfig<unknown>).urlKey ?? key
    urlKeyMap.set(urlKey, key as keyof T)
  }

  // Get URL key for a field
  function getUrlKey(fieldKey: keyof T): string {
    const config = schema[fieldKey] as FieldConfig<unknown>
    return config.urlKey ?? String(fieldKey)
  }

  // Parse URL params into state object
  function parseUrlToState(): T {
    if (!isBrowser) return { ...defaults }

    const params = new URLSearchParams(window.location.search)
    const newState = { ...defaults }

    for (const [key, config] of Object.entries(schema) as [
      keyof T,
      FieldConfig<T[keyof T]>,
    ][]) {
      const urlKey = getUrlKey(key)
      const urlValue = params.get(urlKey)
      newState[key] = deserializeValue(urlValue, config)
    }

    return newState
  }

  // Update URL from current state
  function updateUrlFromState() {
    if (!isBrowser || isUpdatingFromUrl) return

    const params = new URLSearchParams()

    for (const [key, config] of Object.entries(schema) as [
      keyof T,
      FieldConfig<T[keyof T]>,
    ][]) {
      const value = state[key]
      const urlKey = getUrlKey(key)

      // Skip default values - don't serialize them
      if (value === config.default) continue

      const serialized = serializeValue(value)
      if (serialized !== null) {
        params.set(urlKey, serialized)
      }
    }

    const newSearch = params.toString()
    const newUrl = newSearch
      ? `${window.location.pathname}?${newSearch}`
      : window.location.pathname

    // Only update if URL actually changed
    if (window.location.search !== (newSearch ? `?${newSearch}` : '')) {
      window.history.replaceState({}, '', newUrl)
    }
  }

  // Debounced URL updater for fields with debounce config
  const debouncedUpdateUrl = useDebounceFn(updateUrlFromState, globalDebounce)

  // Create field-specific debouncers
  const fieldDebouncers = new Map<string, ReturnType<typeof useDebounceFn>>()
  for (const [key, config] of Object.entries(schema)) {
    const fieldConfig = config as FieldConfig<unknown>
    if (fieldConfig.debounce && fieldConfig.debounce > 0) {
      fieldDebouncers.set(
        key,
        useDebounceFn(updateUrlFromState, fieldConfig.debounce),
      )
    }
  }

  // Handle popstate (browser back/forward)
  function handlePopstate() {
    isUpdatingFromUrl = true
    Object.assign(state, parseUrlToState())
    isUpdatingFromUrl = false
  }

  onMounted(() => {
    // Initialize state from URL
    isUpdatingFromUrl = true
    Object.assign(state, parseUrlToState())
    isUpdatingFromUrl = false

    // Watch for state changes - use getter function for reactive object
    watch(
      () => ({ ...state }) as T,
      (newState, oldState) => {
        if (isUpdatingFromUrl) return

        // Find which field changed and check for field-specific debounce
        for (const key of Object.keys(schema)) {
          if (
            newState[key as keyof T] !==
            (oldState as T | undefined)?.[key as keyof T]
          ) {
            const fieldDebouncer = fieldDebouncers.get(key)
            if (fieldDebouncer) {
              void fieldDebouncer()
              return
            }
          }
        }

        // Use global debounce or immediate update
        if (globalDebounce > 0) {
          void debouncedUpdateUrl()
        } else {
          updateUrlFromState()
        }
      },
      { deep: true },
    )

    // Listen for browser back/forward
    window.addEventListener('popstate', handlePopstate)
  })

  onUnmounted(() => {
    if (isBrowser) {
      window.removeEventListener('popstate', handlePopstate)
    }
  })

  // Reset to defaults
  function reset() {
    Object.assign(state, { ...defaults })
  }

  // Check if any params are non-default
  const hasActiveParams = computed(() => {
    for (const [key, config] of Object.entries(schema) as [
      keyof T,
      FieldConfig<T[keyof T]>,
    ][]) {
      if (state[key] !== config.default) {
        return true
      }
    }
    return false
  })

  return {
    state,
    reset,
    hasActiveParams,
  }
}
