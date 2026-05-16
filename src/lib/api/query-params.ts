export function parseQueryParams<K extends readonly string[]>(
  searchParams: URLSearchParams,
  keys: K,
): Record<K[number], string | undefined> {
  const out = {} as Record<K[number], string | undefined>
  for (const key of keys) {
    out[key as K[number]] = searchParams.get(key) || undefined
  }
  return out
}
