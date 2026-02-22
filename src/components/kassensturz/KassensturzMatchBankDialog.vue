<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { KassensturzBankTransaction } from '@/lib/kassensturz'
import { formatAmount, formatDate } from '@/lib/format'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Search } from 'lucide-vue-next'

const props = defineProps<{
  plannedItemName: string
  bankTransactions: KassensturzBankTransaction[]
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  confirm: [bankTransactionIds: string[]]
}>()

const search = ref('')
const selectedIds = ref<Set<string>>(new Set())

const filteredTransactions = computed(() => {
  if (!search.value) return props.bankTransactions
  const q = search.value.toLowerCase()
  return props.bankTransactions.filter(
    (tx) =>
      tx.counterparty?.toLowerCase().includes(q) ||
      tx.description?.toLowerCase().includes(q) ||
      tx.purpose?.toLowerCase().includes(q) ||
      tx.bookingText?.toLowerCase().includes(q),
  )
})

watch(open, (isOpen) => {
  if (!isOpen) {
    search.value = ''
    selectedIds.value = new Set()
  }
})

function toggleSelection(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedIds.value = next
}

function handleConfirm() {
  emit('confirm', Array.from(selectedIds.value))
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="flex max-h-[80vh] flex-col overflow-hidden sm:max-w-xl"
    >
      <DialogHeader>
        <DialogTitle>Umsätze zuordnen</DialogTitle>
        <DialogDescription>
          Wähle Banktransaktionen für „{{ plannedItemName }}" aus.
        </DialogDescription>
      </DialogHeader>

      <div class="flex min-h-0 flex-1 flex-col gap-3">
        <div class="relative shrink-0">
          <Search
            class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input v-model="search" placeholder="Suchen..." class="pl-9" />
        </div>

        <div class="min-h-0 flex-1 space-y-1 overflow-y-auto">
          <div
            v-for="tx in filteredTransactions"
            :key="tx.id"
            class="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors"
            :class="{ 'border-primary bg-primary/5': selectedIds.has(tx.id) }"
            @click="toggleSelection(tx.id)"
          >
            <Checkbox
              :model-value="selectedIds.has(tx.id)"
              @click.stop
              @update:model-value="toggleSelection(tx.id)"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">
                {{
                  tx.counterparty || tx.description || tx.purpose || 'Unbekannt'
                }}
              </p>
              <p class="text-muted-foreground truncate text-xs">
                {{ formatDate(tx.bookingDate, 'medium') }}
                <span v-if="tx.purpose"> · {{ tx.purpose }}</span>
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
              {{ formatAmount(Math.abs(tx.amountCents)) }}
            </span>
          </div>

          <p
            v-if="filteredTransactions.length === 0"
            class="text-muted-foreground py-6 text-center text-sm"
          >
            Keine nicht zugeordneten Transaktionen gefunden.
          </p>
        </div>
      </div>

      <DialogFooter class="shrink-0">
        <Button variant="outline" @click="open = false">Abbrechen</Button>
        <Button :disabled="selectedIds.size === 0" @click="handleConfirm">
          {{ selectedIds.size }} zuordnen
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
