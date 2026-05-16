import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-vue-next'

export function getSortIcon<T extends string>(
  currentColumn: T,
  currentDir: 'asc' | 'desc',
  column: T,
) {
  if (currentColumn !== column) return ArrowUpDown
  return currentDir === 'asc' ? ArrowUp : ArrowDown
}
