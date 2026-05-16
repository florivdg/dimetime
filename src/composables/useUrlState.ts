import { reactive, watch, onMounted, computed, onUnmounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'

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
  urlKey?: string
  debounce?: number
  enumValues?: readonly T[]
}

type SchemaConfig<T> = {
  [K in keyof T]: FieldConfig<T[K]>
}

interface UseUrlStateOptions {
  debounce?: number
}

interface UseUrlStateReturn<T> {
  state: T
  reset: () => void
  hasActiveParams: { value: boolean }
}

function serializeValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return null
}

function deserializeNumber<T>(value: string, fallback: T): T {
  const num = Number(value)
  return (isNaN(num) ? fallback : num) as T
}

function deserializeNullableBoolean<T>(value: string): T {
  if (value === 'true') return true as T
  if (value === 'false') return false as T
  return null as T
}

function deserializeEnum<T>(value: string, config: FieldConfig<T>): T {
  if (config.enumValues?.includes(value as T)) return value as T
  return config.default
}

const VALUE_DESERIALIZERS: Record<
  FieldType,
  <T>(value: string, config: FieldConfig<T>) => T
> = {
  string: (value) => value as never,
  number: (value, config) => deserializeNumber(value, config.default),
  boolean: (value) => (value === 'true') as never,
  'nullable-boolean': (value) => deserializeNullableBoolean(value),
  enum: deserializeEnum,
  'nullable-enum': deserializeEnum,
  'nullable-string': (value) => (value || null) as never,
}

function deserializeValue<T>(value: string | null, config: FieldConfig<T>): T {
  if (value === null || value === '') return config.default
  const deserializer = VALUE_DESERIALIZERS[config.type]
  return deserializer ? deserializer(value, config) : config.default
}

type SchemaEntry<T> = readonly [keyof T, FieldConfig<T[keyof T]>, string]

function buildSchemaEntries<T extends Record<string, unknown>>(
  schema: SchemaConfig<T>,
): SchemaEntry<T>[] {
  return Object.entries(schema).map(([key, raw]) => {
    const config = raw as FieldConfig<T[keyof T]>
    return [key as keyof T, config, config.urlKey ?? key] as const
  })
}

function parseUrlToState<T extends Record<string, unknown>>(
  entries: SchemaEntry<T>[],
  defaults: T,
): T {
  const params = new URLSearchParams(window.location.search)
  const newState = { ...defaults }
  for (const [key, config, urlKey] of entries) {
    newState[key] = deserializeValue(params.get(urlKey), config)
  }
  return newState
}

function buildUrlParams<T extends Record<string, unknown>>(
  entries: SchemaEntry<T>[],
  state: T,
): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, config, urlKey] of entries) {
    const value = state[key]
    if (value === config.default) continue
    const serialized = serializeValue(value)
    if (serialized !== null) params.set(urlKey, serialized)
  }
  return params
}

function applyHistoryChange(params: URLSearchParams): void {
  const newSearch = params.toString()
  const expectedSearch = newSearch ? `?${newSearch}` : ''
  if (window.location.search === expectedSearch) return

  const newUrl = newSearch
    ? `${window.location.pathname}?${newSearch}`
    : window.location.pathname
  window.history.replaceState({}, '', newUrl)
}

function buildFieldDebouncers<T extends Record<string, unknown>>(
  entries: SchemaEntry<T>[],
  updater: () => void,
): Map<string, ReturnType<typeof useDebounceFn>> {
  const map = new Map<string, ReturnType<typeof useDebounceFn>>()
  for (const [key, config] of entries) {
    if (config.debounce && config.debounce > 0) {
      map.set(String(key), useDebounceFn(updater, config.debounce))
    }
  }
  return map
}

function findChangedFieldDebouncer<T extends Record<string, unknown>>(
  entries: SchemaEntry<T>[],
  fieldDebouncers: Map<string, ReturnType<typeof useDebounceFn>>,
  newState: T,
  oldState: T | undefined,
): ReturnType<typeof useDebounceFn> | undefined {
  for (const [key] of entries) {
    if (newState[key] !== oldState?.[key]) {
      const debouncer = fieldDebouncers.get(String(key))
      if (debouncer) return debouncer
    }
  }
  return undefined
}

export function useUrlState<T extends Record<string, unknown>>(
  schema: SchemaConfig<T>,
  options: UseUrlStateOptions = {},
): UseUrlStateReturn<T> {
  const { debounce: globalDebounce = 0 } = options
  const entries = buildSchemaEntries(schema)
  const defaults = Object.fromEntries(
    entries.map(([key, config]) => [key, config.default]),
  ) as T
  const state = reactive({ ...defaults }) as T

  let isUpdatingFromUrl = false
  const isBrowser = typeof window !== 'undefined'

  function updateUrlFromState() {
    if (!isBrowser || isUpdatingFromUrl) return
    applyHistoryChange(buildUrlParams(entries, state))
  }

  const debouncedUpdateUrl = useDebounceFn(updateUrlFromState, globalDebounce)
  const fieldDebouncers = buildFieldDebouncers(entries, updateUrlFromState)

  function syncStateFromUrl() {
    if (!isBrowser) return
    isUpdatingFromUrl = true
    Object.assign(state, parseUrlToState(entries, defaults))
    isUpdatingFromUrl = false
  }

  function onStateChange(newState: T, oldState: T | undefined) {
    if (isUpdatingFromUrl) return
    const fieldDebouncer = findChangedFieldDebouncer(
      entries,
      fieldDebouncers,
      newState,
      oldState,
    )
    if (fieldDebouncer) {
      void fieldDebouncer()
      return
    }
    if (globalDebounce > 0) void debouncedUpdateUrl()
    else updateUrlFromState()
  }

  onMounted(() => {
    syncStateFromUrl()
    watch(() => ({ ...state }) as T, onStateChange, { deep: true })
    window.addEventListener('popstate', syncStateFromUrl)
  })

  onUnmounted(() => {
    if (isBrowser) window.removeEventListener('popstate', syncStateFromUrl)
  })

  function reset() {
    Object.assign(state, { ...defaults })
  }

  const hasActiveParams = computed(() => {
    for (const [key, config] of entries) {
      if (state[key] !== config.default) return true
    }
    return false
  })

  return { state, reset, hasActiveParams }
}
