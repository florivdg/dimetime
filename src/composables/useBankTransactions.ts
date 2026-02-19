import { ref, watch } from 'vue'
import type {
  BankTransactionWithRelations,
  ImportSource,
} from '@/lib/bank-transactions'
import type { Plan } from '@/lib/plans'
import type { useBankTransactionFilters } from '@/composables/useBankTransactionFilters'

interface InitialData {
  transactions: BankTransactionWithRelations[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  sources: ImportSource[]
  plans: Plan[]
}

export function useBankTransactions(
  filters: ReturnType<typeof useBankTransactionFilters>,
  initialData: InitialData,
) {
  const transactions = ref<BankTransactionWithRelations[]>(
    initialData.transactions,
  )
  const pagination = ref(initialData.pagination)
  const sources = ref<ImportSource[]>(initialData.sources)
  const plans = ref<Plan[]>(initialData.plans)
  const isLoading = ref(false)
  const errorMessage = ref<string | null>(null)

  async function loadTransactions() {
    isLoading.value = true
    errorMessage.value = null
    try {
      const params = new URLSearchParams()
      if (filters.search.value) params.set('search', filters.search.value)
      if (filters.sourceId.value !== 'all') {
        params.set('sourceId', filters.sourceId.value)
      }
      if (filters.status.value !== 'all') {
        params.set('status', filters.status.value)
      }
      if (filters.planId.value !== 'all') {
        params.set('planId', filters.planId.value)
      }
      if (filters.dateFrom.value) params.set('dateFrom', filters.dateFrom.value)
      if (filters.dateTo.value) params.set('dateTo', filters.dateTo.value)
      params.set('sortBy', filters.sortBy.value)
      params.set('sortDir', filters.sortDir.value)
      params.set('page', filters.page.value.toString())
      params.set('limit', '20')

      const response = await fetch(
        `/api/bank-transactions?${params.toString()}`,
      )
      if (!response.ok) throw new Error('Fehler beim Laden')
      const data = await response.json()
      transactions.value = data.transactions
      pagination.value = data.pagination
    } catch {
      errorMessage.value = 'Kontoauszüge konnten nicht geladen werden.'
    } finally {
      isLoading.value = false
    }
  }

  async function loadSources() {
    try {
      const response = await fetch('/api/import-sources')
      if (!response.ok) return
      const data = await response.json()
      sources.value = data.sources
    } catch {
      // Silently ignore
    }
  }

  async function loadPlans() {
    try {
      const response = await fetch('/api/plans')
      if (!response.ok) return
      const data = await response.json()
      plans.value = data.plans
    } catch {
      // Silently ignore
    }
  }

  async function updateTransactionPlan(
    id: string,
    planId: string | null,
  ): Promise<boolean> {
    const tx = transactions.value.find((t) => t.id === id)
    if (!tx) return false

    const original = {
      planId: tx.planId,
      planName: tx.planName,
      planDate: tx.planDate,
      planAssignment: tx.planAssignment,
    }

    // Optimistic update
    if (planId) {
      const targetPlan = plans.value.find((p) => p.id === planId)
      tx.planId = planId
      tx.planName = targetPlan?.name ?? null
      tx.planDate = targetPlan?.date ?? null
      tx.planAssignment = 'manual'
    } else {
      tx.planId = null
      tx.planName = null
      tx.planDate = null
      tx.planAssignment = 'none'
    }

    try {
      const response = await fetch(`/api/bank-transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      if (!response.ok) throw new Error('Update failed')
      return true
    } catch {
      // Rollback
      tx.planId = original.planId
      tx.planName = original.planName
      tx.planDate = original.planDate
      tx.planAssignment = original.planAssignment
      return false
    }
  }

  // Watch filters for changes and auto-fetch
  watch(
    () => ({ ...filters.state }),
    () => loadTransactions(),
    { deep: true },
  )

  return {
    transactions,
    pagination,
    sources,
    plans,
    isLoading,
    errorMessage,
    loadTransactions,
    loadSources,
    loadPlans,
    updateTransactionPlan,
  }
}
