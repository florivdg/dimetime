<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const open = defineModel<boolean>('open', { default: false })
defineProps<{ transaction: { id: string; name: string } | null }>()
const emit = defineEmits<{ confirm: [id: string] }>()
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Transaktion löschen?</AlertDialogTitle>
        <AlertDialogDescription>
          Möchten Sie die Transaktion "{{ transaction?.name }}" wirklich
          löschen? Diese Aktion kann nicht rückgängig gemacht werden.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
        <AlertDialogAction
          @click="transaction && emit('confirm', transaction.id)"
        >
          Löschen
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
