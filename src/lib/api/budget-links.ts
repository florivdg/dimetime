/**
 * Wire contract for the budget-link confirmation of
 * PUT /api/transactions/[id]. Kept free of server imports so the dialogs can
 * share it without pulling the database layer into the client bundle.
 */

/**
 * Marks the 409 that asks for a confirmed retry. Clients have to branch on this
 * code — the transaction route also answers 409 for installment moves.
 */
export const BUDGET_LINKS_CONFIRMATION_CODE =
  'BUDGET_LINKS_CONFIRMATION_REQUIRED'

/** Body of the confirmation 409; both counts are always present. */
export interface BudgetLinksConfirmationPayload {
  error: string
  code: typeof BUDGET_LINKS_CONFIRMATION_CODE
  affectedBankTransactions: number
  affectedSplits: number
}
