import { ref } from 'vue'
import type { TransactionWithCategory } from '@/lib/transactions'

type EmitDeleted = () => void
type EmitError = (message: string) => void

export function useDeleteTransactionDialog(
  emitDeleted: EmitDeleted,
  emitError: EmitError,
) {
  const deleteDialogOpen = ref(false)
  const transactionToDelete = ref<TransactionWithCategory | null>(null)

  function openDeleteDialog(transaction: TransactionWithCategory): void {
    transactionToDelete.value = transaction
    deleteDialogOpen.value = true
  }

  async function deleteTransaction(id: string): Promise<void> {
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Fehler beim Löschen')
      }
      emitDeleted()
    } catch (error) {
      emitError(
        error instanceof Error
          ? error.message
          : 'Transaktion konnte nicht gelöscht werden.',
      )
    }
  }

  return {
    deleteDialogOpen,
    transactionToDelete,
    openDeleteDialog,
    deleteTransaction,
  }
}
