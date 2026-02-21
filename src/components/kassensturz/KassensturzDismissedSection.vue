<script setup lang="ts">
import { ref } from 'vue'
import type { KassensturzDismissedTransaction } from '@/lib/kassensturz'
import { formatAmount, formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronRight, RotateCcw } from 'lucide-vue-next'

const props = defineProps<{
  dismissals: KassensturzDismissedTransaction[]
  isArchived?: boolean
}>()

const emit = defineEmits<{
  undismiss: [dismissalId: string]
}>()

const isOpen = ref(false)
</script>

<template>
  <Collapsible v-if="dismissals.length > 0" v-model:open="isOpen">
    <CollapsibleTrigger as-child>
      <button
        class="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 rounded-md px-1 py-2 text-sm transition-colors"
      >
        <ChevronRight
          class="size-4 transition-transform"
          :class="{ 'rotate-90': isOpen }"
        />
        Verworfene Transaktionen
        <span class="font-normal">({{ dismissals.length }})</span>
      </button>
    </CollapsibleTrigger>

    <CollapsibleContent>
      <div class="space-y-1 pt-1">
        <div
          v-for="d in dismissals"
          :key="d.id"
          class="flex items-center gap-2 rounded-md border border-dashed p-2.5 opacity-60"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm">
              {{
                d.bankTransaction.counterparty ||
                d.bankTransaction.description ||
                'Unbekannt'
              }}
            </p>
            <p class="text-muted-foreground text-xs">
              {{ formatDate(d.bankTransaction.bookingDate, 'medium') }}
              <span v-if="d.reason"> · {{ d.reason }}</span>
            </p>
          </div>

          <span class="text-muted-foreground shrink-0 text-sm">
            {{ formatAmount(Math.abs(d.bankTransaction.amountCents)) }}
          </span>

          <Button
            v-if="!isArchived"
            variant="ghost"
            size="icon"
            class="size-7"
            title="Wiederherstellen"
            @click="emit('undismiss', d.id)"
          >
            <RotateCcw class="size-3.5" />
          </Button>
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
