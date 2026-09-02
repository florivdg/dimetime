import { computed, ref } from 'vue'
import {
  BUDGET_LINKS_CONFIRMATION_CODE,
  type BudgetLinksConfirmationPayload,
} from '@/lib/api/budget-links'

/** Assignments the pending update would drop, as reported by the 409. */
interface BudgetLinkCounts {
  bankTransactions: number
  splits: number
}

/**
 * Handle the "budget links will be cleared" confirmation of
 * PUT /api/transactions/[id]. The route answers 409 with
 * `code: 'BUDGET_LINKS_CONFIRMATION_REQUIRED'` when moving a budget to another
 * plan or unsetting `isBudget` would drop existing assignments; the very same
 * request then has to be retried with `confirmClearBudgetLinks: true`. Always
 * branch on the code - the route also answers 409 for installment moves.
 */
export function useBudgetLinksConfirmation() {
  const pendingLinks = ref<BudgetLinkCounts | null>(null)

  /** True once the route asked for confirmation and none was given yet. */
  const needsConfirmation = computed(() => pendingLinks.value !== null)

  const confirmationWarning = computed(() => {
    if (!pendingLinks.value) return ''
    const { bankTransactions: n, splits: m } = pendingLinks.value
    const parts = [
      n > 0
        ? `${n} ${n === 1 ? 'Banktransaktion' : 'Banktransaktionen'}`
        : null,
      m > 0 ? `${m} ${m === 1 ? 'Split' : 'Splits'}` : null,
    ]
      .filter(Boolean)
      .join(' und ')
    const singular = n + m === 1
    const verb = singular ? 'ist' : 'sind'
    return `Diesem Budget ${verb} noch ${parts} zugeordnet. Wenn Sie fortfahren, ${singular ? 'wird diese Zuordnung' : 'werden diese Zuordnungen'} entfernt.`
  })

  /**
   * Consume an error payload: keeps the counts and reports true when the
   * request merely needs a confirmed retry instead of surfacing an error.
   */
  function requiresConfirmation(data: unknown): boolean {
    const payload = data as Partial<BudgetLinksConfirmationPayload> | null
    if (payload?.code !== BUDGET_LINKS_CONFIRMATION_CODE) return false
    pendingLinks.value = {
      bankTransactions: payload.affectedBankTransactions ?? 0,
      splits: payload.affectedSplits ?? 0,
    }
    return true
  }

  function resetConfirmation(): void {
    pendingLinks.value = null
  }

  return {
    needsConfirmation,
    confirmationWarning,
    requiresConfirmation,
    resetConfirmation,
  }
}
