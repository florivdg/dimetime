<script setup lang="ts">
import { computed } from 'vue'
import type { BankTransactionWithRelations } from '@/lib/bank-transactions'
import type { Plan } from '@/lib/plans'
import { formatAmount, formatDate } from '@/lib/format'
import NoteEditor from './NoteEditor.vue'
import PlanPicker from './PlanPicker.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Landmark,
  Loader2,
  Search,
} from 'lucide-vue-next'

const props = defineProps<{
  transactions: BankTransactionWithRelations[]
  plans: Plan[]
  isLoading: boolean
  searchQuery: string
  sortBy: 'bookingDate' | 'amountCents' | 'createdAt'
  sortDir: 'asc' | 'desc'
  hasActiveFilters: boolean
  selectedIds: Set<string>
}>()

const emit = defineEmits<{
  sort: [column: 'bookingDate' | 'amountCents' | 'createdAt']
  'update:plan': [transactionId: string, planId: string | null]
  'update:note': [transactionId: string, note: string | null]
  'toggle-select': [id: string, shiftKey: boolean]
  'toggle-select-all': []
}>()

const allOnPageSelected = computed(
  () =>
    props.transactions.length > 0 &&
    props.transactions.every((tx) => props.selectedIds.has(tx.id)),
)
const someOnPageSelected = computed(
  () =>
    !allOnPageSelected.value &&
    props.transactions.some((tx) => props.selectedIds.has(tx.id)),
)

function getSortIcon(column: 'bookingDate' | 'amountCents' | 'createdAt') {
  if (props.sortBy !== column) return ArrowUpDown
  return props.sortDir === 'asc' ? ArrowUp : ArrowDown
}

function statusLabel(status: string): string {
  if (status === 'booked') return 'Gebucht'
  if (status === 'pending') return 'Ausstehend'
  return 'Unbekannt'
}

function statusVariant(
  status: string,
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'booked') return 'default'
  if (status === 'pending') return 'secondary'
  return 'outline'
}
</script>

<template>
  <!-- Loading -->
  <div v-if="isLoading" class="flex items-center justify-center py-8">
    <Loader2 class="text-muted-foreground size-6 animate-spin" />
  </div>

  <!-- Empty state -->
  <div
    v-else-if="transactions.length === 0 && !searchQuery && !hasActiveFilters"
    class="py-8 text-center"
  >
    <Landmark class="text-muted-foreground mx-auto mb-4 size-12" />
    <p class="text-muted-foreground">Keine Kontoauszüge vorhanden.</p>
    <p class="text-muted-foreground mt-1 text-sm">
      Importiere Bankdaten über den Import-Button.
    </p>
  </div>

  <!-- No results -->
  <div v-else-if="transactions.length === 0" class="py-8 text-center">
    <Search class="text-muted-foreground mx-auto mb-4 size-12" />
    <p class="text-muted-foreground">Keine Transaktionen gefunden.</p>
  </div>

  <!-- Table -->
  <div v-else class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-10">
            <Checkbox
              :model-value="
                allOnPageSelected
                  ? true
                  : someOnPageSelected
                    ? 'indeterminate'
                    : false
              "
              @update:model-value="emit('toggle-select-all')"
            />
          </TableHead>
          <TableHead class="w-36">
            <Button
              variant="ghost"
              size="sm"
              class="-ml-3"
              @click="emit('sort', 'bookingDate')"
            >
              Datum
              <component :is="getSortIcon('bookingDate')" class="ml-2 size-4" />
            </Button>
          </TableHead>
          <TableHead class="w-10"></TableHead>
          <TableHead>Beschreibung</TableHead>
          <TableHead class="w-36">
            <Button
              variant="ghost"
              size="sm"
              class="-ml-3"
              @click="emit('sort', 'amountCents')"
            >
              Betrag
              <component :is="getSortIcon('amountCents')" class="ml-2 size-4" />
            </Button>
          </TableHead>
          <TableHead class="hidden lg:table-cell">Quelle</TableHead>
          <TableHead class="w-28">Status</TableHead>
          <TableHead class="hidden xl:table-cell">Plan</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="tx in transactions"
          :key="tx.id"
          class="group/row"
          :class="{ 'opacity-60': tx.isArchived }"
        >
          <!-- Checkbox -->
          <TableCell
            class="cursor-pointer"
            @click="(e: MouseEvent) => emit('toggle-select', tx.id, e.shiftKey)"
          >
            <Checkbox :model-value="selectedIds.has(tx.id)" />
          </TableCell>

          <!-- Date -->
          <TableCell>{{ formatDate(tx.bookingDate) }}</TableCell>

          <!-- Note -->
          <TableCell class="px-0">
            <NoteEditor
              :note="tx.note"
              :transaction-id="tx.id"
              @update:note="(id, note) => emit('update:note', id, note)"
            />
          </TableCell>

          <!-- Description -->
          <TableCell>
            <div>
              <TooltipProvider v-if="tx.counterparty ?? tx.description">
                <Tooltip>
                  <span class="flex items-center gap-2">
                    <TooltipTrigger as-child>
                      <span class="max-w-[240px] truncate font-medium">{{
                        tx.counterparty ?? tx.description
                      }}</span>
                    </TooltipTrigger>
                    <Badge v-if="tx.isArchived" variant="outline"
                      >Archiviert</Badge
                    >
                  </span>
                  <TooltipContent v-if="tx.note">
                    <p class="max-w-64">
                      {{
                        tx.note.length > 100
                          ? tx.note.slice(0, 100) + '…'
                          : tx.note
                      }}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </TableCell>

          <!-- Amount -->
          <TableCell>
            <span
              :class="
                tx.amountCents >= 0
                  ? 'text-lime-600 dark:text-lime-400'
                  : 'text-rose-600 dark:text-rose-400'
              "
            >
              {{ formatAmount(tx.amountCents) }}
            </span>
          </TableCell>

          <!-- Source -->
          <TableCell class="hidden lg:table-cell">
            <span class="text-muted-foreground text-sm">{{
              tx.sourceName || '-'
            }}</span>
          </TableCell>

          <!-- Status -->
          <TableCell>
            <Badge :variant="statusVariant(tx.status)">
              {{ statusLabel(tx.status) }}
            </Badge>
          </TableCell>

          <!-- Plan -->
          <TableCell class="hidden xl:table-cell">
            <PlanPicker
              :plans="plans"
              :plan-id="tx.planId"
              :plan-name="tx.planName"
              :plan-date="tx.planDate"
              @select="emit('update:plan', tx.id, $event)"
            />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
