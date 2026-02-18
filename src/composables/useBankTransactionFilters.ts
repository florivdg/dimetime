import { computed } from 'vue'
import { useUrlState } from '@/composables/useUrlState'

export function useBankTransactionFilters() {
  const { state, reset, hasActiveParams } = useUrlState({
    search: { type: 'string', default: '', urlKey: 'q', debounce: 300 },
    sourceId: { type: 'string', default: 'all', urlKey: 'source' },
    status: { type: 'string', default: 'all', urlKey: 'status' },
    dateFrom: { type: 'string', default: '', urlKey: 'from' },
    dateTo: { type: 'string', default: '', urlKey: 'to' },
    sortBy: {
      type: 'enum',
      default: 'bookingDate' as const,
      urlKey: 'sort',
      enumValues: ['bookingDate', 'amountCents', 'createdAt'] as const,
    },
    sortDir: {
      type: 'enum',
      default: 'desc' as const,
      urlKey: 'dir',
      enumValues: ['asc', 'desc'] as const,
    },
    page: { type: 'number', default: 1, urlKey: 'page' },
  })

  const search = computed({
    get: () => state.search,
    set: (v: string) => {
      state.search = v
    },
  })
  const sourceId = computed({
    get: () => state.sourceId,
    set: (v: string) => {
      state.sourceId = v
    },
  })
  const status = computed({
    get: () => state.status,
    set: (v: string) => {
      state.status = v
    },
  })
  const dateFrom = computed({
    get: () => state.dateFrom,
    set: (v: string) => {
      state.dateFrom = v
    },
  })
  const dateTo = computed({
    get: () => state.dateTo,
    set: (v: string) => {
      state.dateTo = v
    },
  })
  const sortBy = computed({
    get: () => state.sortBy,
    set: (v: 'bookingDate' | 'amountCents' | 'createdAt') => {
      state.sortBy = v
    },
  })
  const sortDir = computed({
    get: () => state.sortDir,
    set: (v: 'asc' | 'desc') => {
      state.sortDir = v
    },
  })
  const page = computed({
    get: () => state.page,
    set: (v: number) => {
      state.page = v
    },
  })

  return {
    search,
    sourceId,
    status,
    dateFrom,
    dateTo,
    sortBy,
    sortDir,
    page,
    state,
    hasActiveFilters: hasActiveParams,
    resetFilters: reset,
  }
}
