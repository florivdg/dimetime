<script setup lang="ts">
import { computed } from 'vue'
import type { KassensturzManualEntry } from '@/lib/kassensturz'
import { formatAmount } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { PencilLine, Plus, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  entries: KassensturzManualEntry[]
  isArchived?: boolean
}>()

defineEmits<{
  addEntry: []
  editEntry: [entry: KassensturzManualEntry]
  removeEntry: [entryId: string]
}>()

const incomeCents = computed(() =>
  props.entries
    .filter((e) => e.type === 'income')
    .reduce((sum, e) => sum + Math.abs(e.amountCents), 0),
)

const expenseCents = computed(() =>
  props.entries
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + Math.abs(e.amountCents), 0),
)
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold">Ausnahmen</h3>
      <Button
        v-if="!isArchived"
        variant="ghost"
        size="icon"
        class="size-7"
        title="Ausnahme hinzufügen"
        @click="$emit('addEntry')"
      >
        <Plus class="size-3.5" />
      </Button>
    </div>

    <div
      v-if="entries.length === 0"
      class="text-muted-foreground py-4 text-center text-sm"
    >
      Keine Ausnahmen vorhanden. Nutze den Plus-Button, um z.B. Bargeld oder
      PayPal-Guthaben ohne Zuordnung zu erfassen.
    </div>

    <div
      v-for="entry in entries"
      :key="entry.id"
      class="border-border flex items-center gap-2 rounded-lg border px-3 py-2.5"
    >
      <div class="min-w-0 flex-1">
        <span class="truncate text-sm font-medium">{{ entry.name }}</span>
        <span v-if="entry.note" class="text-muted-foreground ml-2 text-xs">
          {{ entry.note }}
        </span>
      </div>

      <span
        class="shrink-0 text-xs font-semibold"
        :class="
          entry.type === 'income'
            ? 'text-lime-600 dark:text-lime-400'
            : 'text-rose-600 dark:text-rose-400'
        "
      >
        {{ entry.type === 'expense' ? '-' : '+'
        }}{{ formatAmount(Math.abs(entry.amountCents)) }}
      </span>

      <Button
        v-if="!isArchived"
        variant="ghost"
        size="icon"
        class="size-6"
        title="Bearbeiten"
        @click="$emit('editEntry', entry)"
      >
        <PencilLine class="size-3" />
      </Button>
      <Button
        v-if="!isArchived"
        variant="ghost"
        size="icon"
        class="size-6"
        title="Löschen"
        @click="$emit('removeEntry', entry.id)"
      >
        <Trash2 class="size-3" />
      </Button>
    </div>

    <div
      v-if="entries.length > 0"
      class="text-muted-foreground flex items-center justify-end gap-3 text-xs"
    >
      <span v-if="incomeCents > 0" class="text-lime-600 dark:text-lime-400">
        +{{ formatAmount(incomeCents) }}
      </span>
      <span v-if="expenseCents > 0" class="text-rose-600 dark:text-rose-400">
        -{{ formatAmount(expenseCents) }}
      </span>
    </div>
  </div>
</template>
