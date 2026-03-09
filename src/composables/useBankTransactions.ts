import { ref, watch } from 'vue'
import type { BankTransactionRow, ImportSource } from '@/lib/bank-transactions'
import type { Plan } from '@/lib/plans'
import type { useBankTransactionFilters } from '@/composables/useBankTransactionFilters'

interface InitialData {
  rows: BankTransactionRow[]
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
  const rows = ref<BankTransactionRow[]>(initialData.rows)
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
      if (filters.showArchived.value) params.set('showArchived', 'true')
      params.set('sortBy', filters.sortBy.value)
      params.set('sortDir', filters.sortDir.value)
      params.set('page', filters.page.value.toString())
      params.set('limit', '20')

      const response = await fetch(
        `/api/bank-transactions?${params.toString()}`,
      )
      if (!response.ok) throw new Error('Fehler beim Laden')
      const data = await response.json()
      rows.value = data.rows
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
    const row = rows.value.find((r) => r.id === id)
    if (!row) return false

    const original = {
      planId: row.planId,
      planName: row.planName,
      planDate: row.planDate,
      budgetId: row.budgetId,
      budgetName: row.budgetName,
    }

    // Optimistic update
    if (planId) {
      const targetPlan = plans.value.find((p) => p.id === planId)
      row.planId = planId
      row.planName = targetPlan?.name ?? null
      row.planDate = targetPlan?.date ?? null
    } else {
      row.planId = null
      row.planName = null
      row.planDate = null
    }
    row.budgetId = null
    row.budgetName = null

    try {
      const endpoint =
        row.rowType === 'split'
          ? `/api/bank-transactions/splits/${id}`
          : `/api/bank-transactions/${id}`
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      if (!response.ok) throw new Error('Update failed')
      return true
    } catch {
      // Rollback
      row.planId = original.planId
      row.planName = original.planName
      row.planDate = original.planDate
      row.budgetId = original.budgetId
      row.budgetName = original.budgetName
      return false
    }
  }

  async function updateTransactionNote(
    id: string,
    note: string | null,
  ): Promise<boolean> {
    const row = rows.value.find((r) => r.id === id)
    if (!row) return false

    const originalNote = row.note

    // Optimistic update
    row.note = note

    try {
      const response = await fetch(`/api/bank-transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
      if (!response.ok) throw new Error('Update failed')
      return true
    } catch {
      // Rollback
      row.note = originalNote
      return false
    }
  }

  async function updateTransactionBudget(
    id: string,
    budgetId: string | null,
    budgetName: string | null,
  ): Promise<boolean> {
    const row = rows.value.find((r) => r.id === id)
    if (!row) return false

    const originalBudgetId = row.budgetId
    const originalBudgetName = row.budgetName

    // Optimistic update
    row.budgetId = budgetId
    row.budgetName = budgetName

    try {
      const endpoint =
        row.rowType === 'split'
          ? `/api/bank-transactions/splits/${id}`
          : `/api/bank-transactions/${id}`
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgetId }),
      })
      if (!response.ok) throw new Error('Update failed')
      return true
    } catch {
      // Rollback
      row.budgetId = originalBudgetId
      row.budgetName = originalBudgetName
      return false
    }
  }

  async function bulkArchiveTransactions(
    ids: string[],
    isArchived: boolean,
  ): Promise<boolean> {
    try {
      const response = await fetch('/api/bank-transactions/bulk-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, isArchived }),
      })
      if (!response.ok) throw new Error('Bulk archive failed')
      await loadTransactions()
      // If current page is now empty but there are still results, jump to last valid page
      if (
        rows.value.length === 0 &&
        pagination.value.total > 0 &&
        filters.page.value > 1
      ) {
        filters.page.value = Math.max(1, pagination.value.totalPages)
      }
      return true
    } catch {
      errorMessage.value = 'Archivierung konnte nicht durchgeführt werden.'
      return false
    }
  }

  async function bulkAssignPlan(
    ids: string[],
    planId: string | null,
    splitIds: string[] = [],
  ): Promise<boolean> {
    try {
      const response = await fetch('/api/bank-transactions/bulk-assign-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, splitIds, planId }),
      })
      if (!response.ok) throw new Error('Bulk assign plan failed')
      await loadTransactions()
      return true
    } catch {
      errorMessage.value = 'Plan konnte nicht zugewiesen werden.'
      return false
    }
  }

  async function bulkAssignBudget(
    ids: string[],
    budgetId: string | null,
    budgetName: string | null,
    splitIds: string[] = [],
  ): Promise<boolean> {
    const idSet = new Set(ids)
    const splitIdSet = new Set(splitIds)
    const originals = new Map<
      string,
      { budgetId: string | null; budgetName: string | null }
    >()

    // Optimistic update — all rows
    for (const row of rows.value) {
      if (idSet.has(row.id) || splitIdSet.has(row.id)) {
        originals.set(row.id, {
          budgetId: row.budgetId,
          budgetName: row.budgetName,
        })
        row.budgetId = budgetId
        row.budgetName = budgetName
      }
    }

    try {
      const response = await fetch(
        '/api/bank-transactions/bulk-assign-budget',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, splitIds, budgetId }),
        },
      )
      if (!response.ok) throw new Error('Bulk assign budget failed')
      return true
    } catch {
      // Rollback
      for (const row of rows.value) {
        const orig = originals.get(row.id)
        if (orig) {
          row.budgetId = orig.budgetId
          row.budgetName = orig.budgetName
        }
      }
      errorMessage.value = 'Budget konnte nicht zugewiesen werden.'
      return false
    }
  }

  async function splitTransaction(
    id: string,
    splits: { amountCents: number; label?: string }[],
  ): Promise<boolean> {
    try {
      const response = await fetch(`/api/bank-transactions/${id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ splits }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Fehler beim Aufteilen')
      }
      await loadTransactions()
      return true
    } catch {
      errorMessage.value = 'Transaktion konnte nicht aufgeteilt werden.'
      return false
    }
  }

  async function unsplitTransaction(parentId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/bank-transactions/${parentId}/split`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Unsplit failed')
      await loadTransactions()
      return true
    } catch {
      errorMessage.value = 'Aufteilung konnte nicht aufgehoben werden.'
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
    rows,
    pagination,
    sources,
    plans,
    isLoading,
    errorMessage,
    loadTransactions,
    loadSources,
    loadPlans,
    updateTransactionPlan,
    updateTransactionNote,
    updateTransactionBudget,
    bulkArchiveTransactions,
    bulkAssignPlan,
    bulkAssignBudget,
    splitTransaction,
    unsplitTransaction,
  }
}
