interface Writable<T> {
  value: T
}

type SortDir = 'asc' | 'desc'

/**
 * Toggle table sort state: flip direction when the same column is clicked
 * again, otherwise switch to the new column using `defaultDir` (default `asc`).
 * Works with both refs and writable computed refs.
 */
export function toggleSort<C extends string>(
  sortBy: Writable<C>,
  sortDir: Writable<SortDir>,
  column: C,
  defaultDir: (column: C) => SortDir = () => 'asc',
): void {
  if (sortBy.value === column) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = column
    sortDir.value = defaultDir(column)
  }
}
