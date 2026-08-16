<script setup lang="ts">
import { computed, ref } from 'vue'
import type { InstallmentPlanWithStats } from '@/lib/installments'
import { mutateJson } from '@/lib/http'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HandCoins } from 'lucide-vue-next'
import InstallmentConfirmDialog from './InstallmentConfirmDialog.vue'
import InstallmentTableRow from './InstallmentTableRow.vue'

defineProps<{
  installments: InstallmentPlanWithStats[]
}>()

const emit = defineEmits<{
  edit: [installment: InstallmentPlanWithStats]
  completed: [name: string]
  deleted: [name: string]
  error: [message: string]
}>()

const completeDialogOpen = ref(false)
const deleteDialogOpen = ref(false)
const selected = ref<InstallmentPlanWithStats | null>(null)
const isSubmitting = ref(false)

function openCompleteDialog(installment: InstallmentPlanWithStats) {
  selected.value = installment
  completeDialogOpen.value = true
}

function openDeleteDialog(installment: InstallmentPlanWithStats) {
  selected.value = installment
  deleteDialogOpen.value = true
}

const completeDescription = computed(
  () =>
    `"${selected.value?.name ?? ''}" wird als abgelöst markiert. Alle noch offenen Posten dieser Ratenzahlung werden aus den Plänen entfernt. Bereits abgehakte Raten bleiben als Historie erhalten.`,
)

const deleteDescription = computed(
  () =>
    `Möchten Sie die Ratenzahlung "${selected.value?.name ?? ''}" wirklich löschen? Alle noch offenen Posten werden aus den Plänen entfernt, bereits abgehakte Raten bleiben als normale Transaktionen bestehen. Diese Aktion kann nicht rückgängig gemacht werden.`,
)

async function handleComplete() {
  const installment = selected.value
  if (!installment) return

  isSubmitting.value = true
  await mutateJson({
    url: `/api/installments/${installment.id}/complete`,
    method: 'POST',
    notOkMessage: 'Fehler beim Ablösen',
    fallbackMessage: 'Ratenzahlung konnte nicht abgelöst werden.',
    onSuccess: () => emit('completed', installment.name),
    onError: (message) => emit('error', message),
  })
  isSubmitting.value = false
  completeDialogOpen.value = false
  selected.value = null
}

async function handleDelete() {
  const installment = selected.value
  if (!installment) return

  isSubmitting.value = true
  await mutateJson({
    url: `/api/installments/${installment.id}`,
    method: 'DELETE',
    notOkMessage: 'Fehler beim Löschen',
    fallbackMessage: 'Ratenzahlung konnte nicht gelöscht werden.',
    onSuccess: () => emit('deleted', installment.name),
    onError: (message) => emit('error', message),
  })
  isSubmitting.value = false
  deleteDialogOpen.value = false
  selected.value = null
}
</script>

<template>
  <div>
    <div
      v-if="installments.length === 0"
      class="rounded-md border border-dashed p-8 text-center"
    >
      <HandCoins class="text-muted-foreground mx-auto mb-4 size-12" />
      <p class="text-muted-foreground text-sm">
        Keine Ratenzahlungen vorhanden.
      </p>
    </div>

    <div v-else class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Kategorie</TableHead>
            <TableHead class="w-56">Fortschritt</TableHead>
            <TableHead class="w-32">Monatliche Rate</TableHead>
            <TableHead class="w-32">Restsumme</TableHead>
            <TableHead class="w-40">Voraussichtliches Ende</TableHead>
            <TableHead class="w-28 text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <InstallmentTableRow
            v-for="installment in installments"
            :key="installment.id"
            :installment="installment"
            @edit="emit('edit', installment)"
            @complete="openCompleteDialog(installment)"
            @delete="openDeleteDialog(installment)"
          />
        </TableBody>
      </Table>
    </div>

    <InstallmentConfirmDialog
      v-model:open="completeDialogOpen"
      title="Ratenzahlung ablösen?"
      :description="completeDescription"
      action-label="Ablösen"
      :is-submitting="isSubmitting"
      @confirm="handleComplete"
    />

    <InstallmentConfirmDialog
      v-model:open="deleteDialogOpen"
      title="Ratenzahlung löschen?"
      :description="deleteDescription"
      action-label="Löschen"
      :is-submitting="isSubmitting"
      @confirm="handleDelete"
    />
  </div>
</template>
