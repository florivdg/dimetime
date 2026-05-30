import { ref } from 'vue'
import { toast } from 'vue-sonner'
import type { TransactionWithCategory } from '@/lib/transactions'
import type { PresetInitialValues } from '@/components/presets/preset-types'

/**
 * Shared "save transaction as preset" dialog state used by the transaction and
 * plan-detail managers: opens the preset create dialog pre-filled from a
 * transaction and toasts on success.
 */
export function usePresetDialog() {
  const presetDialogOpen = ref(false)
  const presetInitialValues = ref<PresetInitialValues | undefined>(undefined)

  function handleSaveAsPreset(transaction: TransactionWithCategory) {
    presetInitialValues.value = {
      name: transaction.name,
      note: transaction.note,
      amount: transaction.amount,
      type: transaction.type,
      categoryId: transaction.categoryId,
      isBudget: transaction.isBudget,
    }
    presetDialogOpen.value = true
  }

  function handlePresetCreated() {
    toast.success('Vorlage erstellt')
  }

  return {
    presetDialogOpen,
    presetInitialValues,
    handleSaveAsPreset,
    handlePresetCreated,
  }
}
