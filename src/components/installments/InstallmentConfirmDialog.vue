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

defineProps<{
  title: string
  description: string
  /** Label of the confirming button, e.g. "Ablösen". */
  actionLabel: string
  isSubmitting?: boolean
}>()

const emit = defineEmits<{ confirm: [] }>()
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ title }}</AlertDialogTitle>
        <AlertDialogDescription>{{ description }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
        <AlertDialogAction :disabled="isSubmitting" @click="emit('confirm')">
          {{ actionLabel }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
