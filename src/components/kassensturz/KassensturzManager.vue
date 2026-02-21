<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import type { Plan } from '@/lib/plans'
import type {
  KassensturzManualEntry,
  KassensturzSummary,
} from '@/lib/kassensturz'
import { useKassensturz } from '@/composables/useKassensturz'
import { toast } from 'vue-sonner'
import { Loader2 } from 'lucide-vue-next'

import KassensturzPlannedItemsList from './KassensturzPlannedItemsList.vue'
import KassensturzUnmatchedSection from './KassensturzUnmatchedSection.vue'
import KassensturzDismissedSection from './KassensturzDismissedSection.vue'
import KassensturzMatchBankDialog from './KassensturzMatchBankDialog.vue'
import KassensturzManualEntryDialog from './KassensturzManualEntryDialog.vue'
import KassensturzExceptionsList from './KassensturzExceptionsList.vue'

const props = defineProps<{
  plan: Plan
}>()

const emit = defineEmits<{
  summaryUpdate: [summary: KassensturzSummary]
}>()

const {
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
} = useKassensturz(props.plan.id)

onMounted(() => {
  load()
})

// Emit summary to parent whenever it changes
watch(summary, (val) => emit('summaryUpdate', val), {
  immediate: true,
  deep: true,
})

// Match dialog
const matchDialogOpen = ref(false)
const matchPlannedItemId = ref<string | null>(null)
const matchPlannedItemName = ref('')

function handleMatchDialog(plannedItemId: string, plannedItemName: string) {
  matchPlannedItemId.value = plannedItemId
  matchPlannedItemName.value = plannedItemName
  matchDialogOpen.value = true
}

async function handleMatchConfirm(bankTransactionIds: string[]) {
  if (!matchPlannedItemId.value) return
  try {
    await reconcileMany(bankTransactionIds, matchPlannedItemId.value)
    toast.success(`${bankTransactionIds.length} Umsatz/Umsätze zugeordnet`)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Zuordnung fehlgeschlagen')
  }
}

// Manual entry dialog
const manualEntryDialogOpen = ref(false)
const manualEntryPlannedItemId = ref<string | null>(null)
const editingManualEntry = ref<KassensturzManualEntry | null>(null)
const manualEntryDefaultType = ref<'income' | 'expense' | undefined>(undefined)

function handleManualEntryFromPlanned(plannedItemId: string) {
  manualEntryPlannedItemId.value = plannedItemId
  editingManualEntry.value = null
  manualEntryDefaultType.value = undefined
  manualEntryDialogOpen.value = true
}

function handleManualEntryStandalone() {
  manualEntryPlannedItemId.value = null
  editingManualEntry.value = null
  manualEntryDefaultType.value = 'income'
  manualEntryDialogOpen.value = true
}

function handleEditManualEntry(entry: KassensturzManualEntry) {
  editingManualEntry.value = entry
  manualEntryPlannedItemId.value = null
  manualEntryDefaultType.value = undefined
  manualEntryDialogOpen.value = true
}

async function handleManualEntrySave(data: {
  name: string
  note?: string
  amountCents: number
  type: 'income' | 'expense'
  plannedTransactionId?: string
}) {
  try {
    await addManualEntry(data)
    toast.success('Manueller Eintrag erstellt')
  } catch (e) {
    toast.error(
      e instanceof Error ? e.message : 'Eintrag konnte nicht erstellt werden',
    )
  }
}

async function handleManualEntryUpdate(data: {
  entryId: string
  name: string
  note?: string | null
  amountCents: number
  type: 'income' | 'expense'
  plannedTransactionId?: string | null
}) {
  try {
    await editManualEntry(data)
    toast.success('Eintrag aktualisiert')
  } catch (e) {
    toast.error(
      e instanceof Error
        ? e.message
        : 'Eintrag konnte nicht aktualisiert werden',
    )
  }
}

// Remove reconciliation
async function handleRemoveMatch(reconciliationId: string) {
  try {
    await removeMatch(reconciliationId)
    toast.success('Zuordnung entfernt')
  } catch (e) {
    toast.error(
      e instanceof Error ? e.message : 'Zuordnung konnte nicht entfernt werden',
    )
  }
}

// Remove manual entry
async function handleRemoveManualEntry(entryId: string) {
  try {
    await removeManualEntry(entryId)
    toast.success('Eintrag gelöscht')
  } catch (e) {
    toast.error(
      e instanceof Error ? e.message : 'Eintrag konnte nicht gelöscht werden',
    )
  }
}

// Dismiss
async function handleDismiss(bankTransactionId: string, reason?: string) {
  try {
    await dismiss(bankTransactionId, reason)
    toast.success('Umsatz verworfen')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Verwerfen fehlgeschlagen')
  }
}

// Undismiss
async function handleUndismiss(dismissalId: string) {
  try {
    await undismiss(dismissalId)
    toast.success('Umsatz wiederhergestellt')
  } catch (e) {
    toast.error(
      e instanceof Error ? e.message : 'Wiederherstellen fehlgeschlagen',
    )
  }
}

// Reconcile from unmatched section or drag & drop
async function handleReconcile(
  bankTransactionId: string,
  plannedTransactionId: string,
) {
  try {
    await reconcile(bankTransactionId, plannedTransactionId)
    toast.success('Umsatz zugeordnet')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Zuordnung fehlgeschlagen')
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Loading state -->
    <div
      v-if="isLoading && plannedItems.length === 0"
      class="flex items-center justify-center py-12"
    >
      <Loader2 class="text-muted-foreground size-6 animate-spin" />
    </div>

    <!-- Error state -->
    <div
      v-if="error"
      class="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
    >
      {{ error }}
    </div>

    <template v-if="!isLoading || plannedItems.length > 0">
      <div class="flex flex-col gap-6 lg:grid lg:grid-cols-2">
        <!-- Linke Spalte: Geplante Posten -->
        <div
          class="space-y-6 lg:max-h-[calc(100vh-16rem)] lg:overflow-y-auto lg:pr-2"
        >
          <KassensturzPlannedItemsList
            :items="incomeItems"
            :unmatched-bank-transactions="unmatchedBankTransactions"
            section-title="Einnahmen"
            section-type="income"
            :is-archived="plan.isArchived"
            @match-dialog="handleMatchDialog"
            @manual-entry="handleManualEntryFromPlanned"
            @remove-match="handleRemoveMatch"
            @edit-manual-entry="handleEditManualEntry"
            @remove-manual-entry="handleRemoveManualEntry"
            @drop="handleReconcile"
          />

          <KassensturzPlannedItemsList
            :items="expenseItems"
            :unmatched-bank-transactions="unmatchedBankTransactions"
            section-title="Ausgaben"
            section-type="expense"
            :is-archived="plan.isArchived"
            @match-dialog="handleMatchDialog"
            @manual-entry="handleManualEntryFromPlanned"
            @remove-match="handleRemoveMatch"
            @edit-manual-entry="handleEditManualEntry"
            @remove-manual-entry="handleRemoveManualEntry"
            @drop="handleReconcile"
          />

          <KassensturzExceptionsList
            :entries="unassignedManualEntries"
            :is-archived="plan.isArchived"
            @add-entry="handleManualEntryStandalone"
            @edit-entry="handleEditManualEntry"
            @remove-entry="handleRemoveManualEntry"
          />
        </div>

        <!-- Rechte Spalte: Banktransaktionen -->
        <div
          class="space-y-4 lg:max-h-[calc(100vh-16rem)] lg:overflow-y-auto lg:pl-2"
        >
          <KassensturzUnmatchedSection
            :transactions="unmatchedBankTransactions"
            :planned-items="plannedItems"
            :is-archived="plan.isArchived"
            @dismiss="handleDismiss"
            @reconcile="handleReconcile"
          />

          <KassensturzDismissedSection
            :dismissals="dismissals"
            :is-archived="plan.isArchived"
            @undismiss="handleUndismiss"
          />
        </div>
      </div>
    </template>

    <!-- Match Bank Dialog -->
    <KassensturzMatchBankDialog
      v-model:open="matchDialogOpen"
      :planned-item-name="matchPlannedItemName"
      :bank-transactions="unmatchedBankTransactions"
      @confirm="handleMatchConfirm"
    />

    <!-- Manual Entry Dialog -->
    <KassensturzManualEntryDialog
      v-model:open="manualEntryDialogOpen"
      :planned-items="plannedItems"
      :edit-entry="editingManualEntry"
      :preselected-planned-item-id="manualEntryPlannedItemId"
      :default-type="manualEntryDefaultType"
      @save="handleManualEntrySave"
      @update="handleManualEntryUpdate"
    />
  </div>
</template>
