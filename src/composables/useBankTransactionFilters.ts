import { computed } from 'vue'
import { useUrlState } from '@/composables/useUrlState'

export function useBankTransactionFilters() {
  const { state, reset, hasActiveParams } = useUrlState({
    search: { type: 'string', default: '', urlKey: 'q', debounce: 300 },
    sourceId: { type: 'string', default: 'all', urlKey: 'source' },
    status: { type: 'string', default: 'all', urlKey: 'status' },
    planId: { type: 'string', default: 'all', urlKey: 'plan' },
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
      if (state.search === v) return
      state.search = v
      state.page = 1
    },
  })
  const sourceId = computed({
    get: () => state.sourceId,
    set: (v: string) => {
      if (state.sourceId === v) return
      state.sourceId = v
      state.page = 1
    },
  })
  const status = computed({
    get: () => state.status,
    set: (v: string) => {
      if (state.status === v) return
      state.status = v
      state.page = 1
    },
  })
  const planId = computed({
    get: () => state.planId,
    set: (v: string) => {
      if (state.planId === v) return
      state.planId = v
      state.page = 1
    },
  })
  const dateFrom = computed({
    get: () => state.dateFrom,
    set: (v: string) => {
      if (state.dateFrom === v) return
      state.dateFrom = v
      state.page = 1
    },
  })
  const dateTo = computed({
    get: () => state.dateTo,
    set: (v: string) => {
      if (state.dateTo === v) return
      state.dateTo = v
      state.page = 1
    },
  })
  const sortBy = computed({
    get: () => state.sortBy,
    set: (v: 'bookingDate' | 'amountCents' | 'createdAt') => {
      if (state.sortBy === v) return
      state.sortBy = v
      state.page = 1
    },
  })
  const sortDir = computed({
    get: () => state.sortDir,
    set: (v: 'asc' | 'desc') => {
      if (state.sortDir === v) return
      state.sortDir = v
      state.page = 1
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
    planId,
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
