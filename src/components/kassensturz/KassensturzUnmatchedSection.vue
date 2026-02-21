<script setup lang="ts">
import { ref, computed } from 'vue'
import type {
  KassensturzBankTransaction,
  KassensturzPlannedItem,
} from '@/lib/kassensturz'
import { formatAmount, formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EyeOff, GripVertical, Link, Search } from 'lucide-vue-next'

const props = defineProps<{
  transactions: KassensturzBankTransaction[]
  plannedItems: KassensturzPlannedItem[]
  isArchived?: boolean
}>()

const emit = defineEmits<{
  dismiss: [bankTransactionId: string, reason?: string]
  reconcile: [bankTransactionId: string, plannedTransactionId: string]
}>()

const search = ref('')

const filteredTransactions = computed(() => {
  if (!search.value) return props.transactions
  const q = search.value.toLowerCase()
  return props.transactions.filter(
    (tx) =>
      tx.counterparty?.toLowerCase().includes(q) ||
      tx.description?.toLowerCase().includes(q) ||
      tx.purpose?.toLowerCase().includes(q) ||
      tx.bookingText?.toLowerCase().includes(q),
  )
})

// Assign dialog state
const assignDialogOpen = ref(false)
const assigningTxId = ref<string | null>(null)
const selectedPlannedItemId = ref<string | undefined>(undefined)

function openAssignDialog(txId: string) {
  assigningTxId.value = txId
  selectedPlannedItemId.value = undefined
  assignDialogOpen.value = true
}

function handleAssignConfirm() {
  if (assigningTxId.value && selectedPlannedItemId.value) {
    emit('reconcile', assigningTxId.value, selectedPlannedItemId.value)
  }
  assignDialogOpen.value = false
}

// Dismiss dialog state
const dismissDialogOpen = ref(false)
const dismissingTxId = ref<string | null>(null)
const dismissReason = ref('')

function openDismissDialog(txId: string) {
  dismissingTxId.value = txId
  dismissReason.value = ''
  dismissDialogOpen.value = true
}

function handleDismissConfirm() {
  if (dismissingTxId.value) {
    emit('dismiss', dismissingTxId.value, dismissReason.value || undefined)
  }
  dismissDialogOpen.value = false
}

function handleDragStart(e: DragEvent, txId: string) {
  if (e.dataTransfer) {
    e.dataTransfer.setData('text/plain', txId)
    e.dataTransfer.effectAllowed = 'link'
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-3">
      <h3 class="text-sm font-semibold">
        Nicht zugeordnete Umsätze
        <span class="text-muted-foreground font-normal">
          ({{ transactions.length }})
        </span>
      </h3>
      <div class="relative w-48">
        <Search
          class="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
        />
        <Input
          v-model="search"
          placeholder="Filtern..."
          class="h-8 pl-8 text-sm"
        />
      </div>
    </div>

    <div
      v-if="filteredTransactions.length === 0"
      class="text-muted-foreground py-6 text-center text-sm"
    >
      {{
        transactions.length === 0
          ? 'Alle Umsätze sind zugeordnet oder verworfen.'
          : 'Keine Treffer.'
      }}
    </div>

    <div class="space-y-1">
      <div
        v-for="tx in filteredTransactions"
        :key="tx.id"
        :draggable="!isArchived"
        :class="[
          'hover:bg-muted/50 flex items-center gap-2 rounded-md border p-2.5 transition-colors',
          !isArchived ? 'cursor-grab active:cursor-grabbing' : '',
        ]"
        @dragstart="!isArchived && handleDragStart($event, tx.id)"
      >
        <GripVertical
          v-if="!isArchived"
          class="text-muted-foreground/50 size-4 shrink-0"
        />

        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">
            {{ tx.counterparty || tx.description || tx.purpose || 'Unbekannt' }}
          </p>
          <p class="text-muted-foreground truncate text-xs">
            {{ formatDate(tx.bookingDate, 'medium') }}
            <span v-if="tx.purpose && tx.counterparty">
              · {{ tx.purpose }}</span
            >
          </p>
        </div>

        <span
          class="shrink-0 text-sm font-semibold"
          :class="
            tx.amountCents >= 0
              ? 'text-lime-600 dark:text-lime-400'
              : 'text-rose-600 dark:text-rose-400'
          "
        >
          {{ tx.amountCents >= 0 ? '+' : '' }}{{ formatAmount(tx.amountCents) }}
        </span>

        <div v-if="!isArchived" class="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            class="size-7"
            title="Zuordnen"
            @click="openAssignDialog(tx.id)"
          >
            <Link class="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="size-7"
            title="Verwerfen"
            @click="openDismissDialog(tx.id)"
          >
            <EyeOff class="size-3.5" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Assign Dialog -->
    <Dialog v-model:open="assignDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Umsatz zuordnen</DialogTitle>
          <DialogDescription>
            Wähle einen geplanten Posten für diese Banktransaktion.
          </DialogDescription>
        </DialogHeader>

        <Select v-model="selectedPlannedItemId">
          <SelectTrigger>
            <SelectValue placeholder="Geplanten Posten wählen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="item in plannedItems"
              :key="item.id"
              :value="item.id"
            >
              {{ item.name }} ({{ formatAmount(Math.abs(item.amount)) }})
            </SelectItem>
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" @click="assignDialogOpen = false">
            Abbrechen
          </Button>
          <Button
            :disabled="!selectedPlannedItemId"
            @click="handleAssignConfirm"
          >
            Zuordnen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dismiss Dialog -->
    <Dialog v-model:open="dismissDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Umsatz verwerfen</DialogTitle>
          <DialogDescription>
            Dieser Umsatz wird aus der Kassensturz-Berechnung ausgeblendet (z.B.
            interne Umbuchung).
          </DialogDescription>
        </DialogHeader>

        <Input
          v-model="dismissReason"
          placeholder="Grund (optional, z.B. 'Interne Umbuchung')"
        />

        <DialogFooter>
          <Button variant="outline" @click="dismissDialogOpen = false">
            Abbrechen
          </Button>
          <Button @click="handleDismissConfirm">Verwerfen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
