<script setup lang="ts">
import { ref } from 'vue'
import type {
  KassensturzPlannedItem,
  KassensturzBankTransaction,
  KassensturzManualEntry,
} from '@/lib/kassensturz'
import { formatAmount, formatDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ChevronRight,
  Link,
  PencilLine,
  Plus,
  Trash2,
  X,
} from 'lucide-vue-next'

const props = defineProps<{
  items: KassensturzPlannedItem[]
  unmatchedBankTransactions: KassensturzBankTransaction[]
  sectionTitle: string
  sectionType: 'income' | 'expense'
  isArchived?: boolean
}>()

const emit = defineEmits<{
  matchDialog: [plannedItemId: string, plannedItemName: string]
  manualEntry: [plannedItemId: string]
  removeMatch: [reconciliationId: string]
  editManualEntry: [entry: KassensturzManualEntry]
  removeManualEntry: [entryId: string]
  drop: [bankTransactionId: string, plannedTransactionId: string]
}>()

const openItems = ref<Set<string>>(new Set())
const dragOverItem = ref<string | null>(null)

function toggleItem(id: string) {
  const next = new Set(openItems.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  openItems.value = next
}

function statusVariant(status: string) {
  switch (status) {
    case 'erfuellt':
      return 'default'
    case 'teilweise':
      return 'secondary'
    case 'ueberzogen':
      return 'destructive'
    default:
      return 'outline'
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'erfuellt':
      return 'Erfüllt'
    case 'teilweise':
      return 'Teilweise'
    case 'ueberzogen':
      return 'Überzogen'
    default:
      return 'Offen'
  }
}

function progressPercent(item: KassensturzPlannedItem) {
  const planned = Math.abs(item.amount)
  if (planned === 0) return 0
  return Math.min(100, (item.matchedAmountCents / planned) * 100)
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'link'
  }
}

function handleDragEnter(e: DragEvent, itemId: string) {
  e.preventDefault()
  dragOverItem.value = itemId
}

function handleDragLeave(e: DragEvent, itemId: string) {
  const related = e.relatedTarget as Node | null
  const target = e.currentTarget as HTMLElement
  if (!related || !target.contains(related)) {
    if (dragOverItem.value === itemId) {
      dragOverItem.value = null
    }
  }
}

function handleDrop(e: DragEvent, plannedTransactionId: string) {
  e.preventDefault()
  dragOverItem.value = null
  const bankTransactionId = e.dataTransfer?.getData('text/plain')
  if (bankTransactionId) {
    emit('drop', bankTransactionId, plannedTransactionId)
  }
}
</script>

<template>
  <div class="space-y-2">
    <h3 class="text-sm font-semibold">{{ sectionTitle }}</h3>

    <div
      v-if="items.length === 0"
      class="text-muted-foreground py-4 text-center text-sm"
    >
      Keine {{ sectionType === 'income' ? 'Einnahmen' : 'Ausgaben' }} geplant.
    </div>

    <div
      v-for="item in items"
      :key="item.id"
      class="rounded-lg border transition-colors"
      :class="
        dragOverItem === item.id
          ? 'border-primary bg-primary/5'
          : 'border-border'
      "
      @dragover="!isArchived && handleDragOver($event)"
      @dragenter="!isArchived && handleDragEnter($event, item.id)"
      @dragleave="!isArchived && handleDragLeave($event, item.id)"
      @drop="!isArchived && handleDrop($event, item.id)"
    >
      <Collapsible :open="openItems.has(item.id)">
        <div class="flex items-center gap-3 p-3">
          <CollapsibleTrigger as-child>
            <button
              class="hover:bg-muted flex size-6 shrink-0 items-center justify-center rounded transition-colors"
              @click="toggleItem(item.id)"
            >
              <ChevronRight
                class="size-4 transition-transform"
                :class="{ 'rotate-90': openItems.has(item.id) }"
              />
            </button>
          </CollapsibleTrigger>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-medium">{{ item.name }}</span>
              <Badge :variant="statusVariant(item.status)" class="text-[10px]">
                {{ statusLabel(item.status) }}
              </Badge>
              <span
                v-if="item.categoryName"
                class="text-muted-foreground hidden text-xs sm:inline"
              >
                {{ item.categoryName }}
              </span>
            </div>
            <div class="mt-1 flex items-center gap-2">
              <Progress
                :model-value="progressPercent(item)"
                class="h-1.5 flex-1"
              />
              <span class="text-muted-foreground shrink-0 text-xs">
                {{ formatAmount(item.matchedAmountCents) }} /
                {{ formatAmount(Math.abs(item.amount)) }}
              </span>
            </div>
          </div>

          <div v-if="!isArchived" class="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              class="size-7"
              title="Umsatz zuordnen"
              @click="emit('matchDialog', item.id, item.name)"
            >
              <Link class="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="size-7"
              title="Manueller Eintrag"
              @click="emit('manualEntry', item.id)"
            >
              <Plus class="size-3.5" />
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <div class="border-t px-3 pt-2 pb-3">
            <!-- Reconciled bank transactions -->
            <div v-if="item.reconciliations.length > 0" class="space-y-1">
              <p class="text-muted-foreground mb-1 text-xs font-medium">
                Zugeordnete Umsätze
              </p>
              <div
                v-for="rec in item.reconciliations"
                :key="rec.id"
                class="bg-muted/50 flex items-center gap-2 rounded px-2 py-1.5 text-sm"
              >
                <div class="min-w-0 flex-1">
                  <span class="truncate">
                    {{
                      rec.bankTransaction.counterparty ||
                      rec.bankTransaction.description ||
                      'Unbekannt'
                    }}
                  </span>
                  <span class="text-muted-foreground ml-2 text-xs">
                    {{ formatDate(rec.bankTransaction.bookingDate, 'short') }}
                  </span>
                </div>
                <span
                  class="shrink-0 text-xs font-semibold"
                  :class="
                    rec.bankTransaction.amountCents >= 0
                      ? 'text-lime-600 dark:text-lime-400'
                      : 'text-rose-600 dark:text-rose-400'
                  "
                >
                  {{ formatAmount(Math.abs(rec.bankTransaction.amountCents)) }}
                </span>
                <Button
                  v-if="!isArchived"
                  variant="ghost"
                  size="icon"
                  class="size-6"
                  title="Zuordnung entfernen"
                  @click="emit('removeMatch', rec.id)"
                >
                  <X class="size-3" />
                </Button>
              </div>
            </div>

            <!-- Manual entries -->
            <div v-if="item.manualEntries.length > 0" class="mt-2 space-y-1">
              <p class="text-muted-foreground mb-1 text-xs font-medium">
                Manuelle Einträge
              </p>
              <div
                v-for="entry in item.manualEntries"
                :key="entry.id"
                class="bg-muted/50 flex items-center gap-2 rounded px-2 py-1.5 text-sm"
              >
                <div class="min-w-0 flex-1">
                  <span class="truncate">{{ entry.name }}</span>
                  <span
                    v-if="entry.note"
                    class="text-muted-foreground ml-2 text-xs"
                  >
                    {{ entry.note }}
                  </span>
                </div>
                <span
                  class="text-muted-foreground shrink-0 text-xs font-semibold"
                >
                  {{ formatAmount(Math.abs(entry.amountCents)) }}
                </span>
                <Button
                  v-if="!isArchived"
                  variant="ghost"
                  size="icon"
                  class="size-6"
                  title="Bearbeiten"
                  @click="emit('editManualEntry', entry)"
                >
                  <PencilLine class="size-3" />
                </Button>
                <Button
                  v-if="!isArchived"
                  variant="ghost"
                  size="icon"
                  class="size-6"
                  title="Löschen"
                  @click="emit('removeManualEntry', entry.id)"
                >
                  <Trash2 class="size-3" />
                </Button>
              </div>
            </div>

            <p
              v-if="
                item.reconciliations.length === 0 &&
                item.manualEntries.length === 0
              "
              class="text-muted-foreground py-2 text-center text-xs"
            >
              Noch keine Zuordnungen. Ziehe einen Umsatz hierher oder nutze die
              Buttons.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  </div>
</template>
