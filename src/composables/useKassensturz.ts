import { ref, computed } from 'vue'
import type {
  KassensturzData,
  KassensturzPlannedItem,
  KassensturzBankTransaction,
  KassensturzDismissedTransaction,
  KassensturzManualEntry,
  KassensturzSummary,
} from '@/lib/kassensturz'

export function useKassensturz(planId: string) {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const summary = ref<KassensturzSummary>({
    plannedIncome: 0,
    plannedExpense: 0,
    plannedNet: 0,
    actualIncome: 0,
    actualExpense: 0,
    actualNet: 0,
  })
  const plannedItems = ref<KassensturzPlannedItem[]>([])
  const unmatchedBankTransactions = ref<KassensturzBankTransaction[]>([])
  const dismissals = ref<KassensturzDismissedTransaction[]>([])
  const manualEntries = ref<KassensturzManualEntry[]>([])

  const incomeItems = computed(() =>
    plannedItems.value.filter((item) => item.type === 'income'),
  )
  const expenseItems = computed(() =>
    plannedItems.value.filter((item) => item.type === 'expense'),
  )
  const unassignedManualEntries = computed(() =>
    manualEntries.value.filter((e) => !e.plannedTransactionId),
  )

  async function load() {
    isLoading.value = true
    error.value = null
    try {
      const response = await fetch(`/api/plans/${planId}/kassensturz`)
      if (!response.ok)
        throw new Error('Fehler beim Laden der Kassensturz-Daten')
      const data: KassensturzData = await response.json()
      summary.value = data.summary
      plannedItems.value = data.plannedItems
      unmatchedBankTransactions.value = data.unmatchedBankTransactions
      dismissals.value = data.dismissals
      manualEntries.value = data.manualEntries
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unbekannter Fehler'
    } finally {
      isLoading.value = false
    }
  }

  async function reconcile(
    bankTransactionId: string,
    plannedTransactionId: string,
  ) {
    const response = await fetch(`/api/plans/${planId}/kassensturz/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankTransactionId, plannedTransactionId }),
    })
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error ?? 'Zuordnung fehlgeschlagen')
    }
    await load()
  }

  async function reconcileMany(
    bankTransactionIds: string[],
    plannedTransactionId: string,
  ) {
    for (const bankTxId of bankTransactionIds) {
      const response = await fetch(
        `/api/plans/${planId}/kassensturz/reconcile`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bankTransactionId: bankTxId,
            plannedTransactionId,
          }),
        },
      )
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Zuordnung fehlgeschlagen')
      }
    }
    await load()
  }

  async function removeMatch(reconciliationId: string) {
    const response = await fetch(`/api/plans/${planId}/kassensturz/reconcile`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reconciliationId }),
    })
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error ?? 'Zuordnung konnte nicht entfernt werden')
    }
    await load()
  }

  async function dismiss(bankTransactionId: string, reason?: string) {
    // Optimistic update: remove from unmatched
    const idx = unmatchedBankTransactions.value.findIndex(
      (tx) => tx.id === bankTransactionId,
    )
    const removed =
      idx !== -1 ? unmatchedBankTransactions.value.splice(idx, 1)[0] : null

    try {
      const response = await fetch(`/api/plans/${planId}/kassensturz/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankTransactionId, reason }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Verwerfen fehlgeschlagen')
      }
      await load()
    } catch (e) {
      // Rollback
      if (removed && idx !== -1) {
        unmatchedBankTransactions.value.splice(idx, 0, removed)
      }
      throw e
    }
  }

  async function undismiss(dismissalId: string) {
    const response = await fetch(`/api/plans/${planId}/kassensturz/dismiss`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dismissalId }),
    })
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error ?? 'Wiederherstellen fehlgeschlagen')
    }
    await load()
  }

  async function addManualEntry(input: {
    name: string
    note?: string
    amountCents: number
    type: 'income' | 'expense'
    plannedTransactionId?: string
  }) {
    const response = await fetch(
      `/api/plans/${planId}/kassensturz/manual-entries`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    )
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error ?? 'Eintrag konnte nicht erstellt werden')
    }
    await load()
  }

  async function editManualEntry(input: {
    entryId: string
    name?: string
    note?: string | null
    amountCents?: number
    type?: 'income' | 'expense'
    plannedTransactionId?: string | null
  }) {
    const response = await fetch(
      `/api/plans/${planId}/kassensturz/manual-entries`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    )
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error ?? 'Eintrag konnte nicht bearbeitet werden')
    }
    await load()
  }

  async function removeManualEntry(entryId: string) {
    const response = await fetch(
      `/api/plans/${planId}/kassensturz/manual-entries`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId }),
      },
    )
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error ?? 'Eintrag konnte nicht gelöscht werden')
    }
    await load()
  }

  return {
    isLoading,
    error,
    summary,
    plannedItems,
    incomeItems,
    expenseItems,
    unassignedManualEntries,
    unmatchedBankTransactions,
    dismissals,
    manualEntries,
    load,
    reconcile,
    reconcileMany,
    removeMatch,
    dismiss,
    undismiss,
    addManualEntry,
    editManualEntry,
    removeManualEntry,
  }
}
