import { computed, ref } from 'vue'

export interface UseDeleteConfirmationOptions {
  confirmWord?: string
}

export function useDeleteConfirmation(
  options: UseDeleteConfirmationOptions = {},
) {
  const confirmWord = options.confirmWord ?? 'löschen'
  const deleteConfirmation = ref('')

  const isDeleteConfirmed = computed(
    () => deleteConfirmation.value.toLowerCase() === confirmWord.toLowerCase(),
  )

  function resetDeleteConfirmation() {
    deleteConfirmation.value = ''
  }

  return {
    deleteConfirmation,
    isDeleteConfirmed,
    resetDeleteConfirmation,
  }
}
