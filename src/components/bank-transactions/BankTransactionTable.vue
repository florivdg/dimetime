<script setup lang="ts">
import { computed } from 'vue'
import type { BankTransactionRow } from '@/lib/bank-transactions'
import type { Plan } from '@/lib/plans'
import { formatAmount, formatDate } from '@/lib/format'
import BudgetPicker from './BudgetPicker.vue'
import NoteEditor from './NoteEditor.vue'
import PlanPicker from './PlanPicker.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  GitBranch,
  Landmark,
  Loader2,
  MoreVertical,
  Search,
  Split,
  Undo2,
} from 'lucide-vue-next'

const props = defineProps<{
  rows: BankTransactionRow[]
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
  'update:plan': [id: string, planId: string | null]
  'update:budget': [
    id: string,
    budgetId: string | null,
    budgetName: string | null,
  ]
  'update:note': [transactionId: string, note: string | null]
  'toggle-select': [id: string, shiftKey: boolean]
  'toggle-select-all': []
  'open-split': [row: BankTransactionRow]
  'undo-split': [parentId: string]
}>()

const allOnPageSelected = computed(
  () =>
    props.rows.length > 0 &&
    props.rows.every((row) => props.selectedIds.has(row.id)),
)
const someOnPageSelected = computed(
  () =>
    !allOnPageSelected.value &&
    props.rows.some((row) => props.selectedIds.has(row.id)),
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
    v-else-if="rows.length === 0 && !searchQuery && !hasActiveFilters"
    class="py-8 text-center"
  >
    <Landmark class="text-muted-foreground mx-auto mb-4 size-12" />
    <p class="text-muted-foreground">Keine Kontoauszüge vorhanden.</p>
    <p class="text-muted-foreground mt-1 text-sm">
      Importiere Bankdaten über den Import-Button.
    </p>
  </div>

  <!-- No results -->
  <div v-else-if="rows.length === 0" class="py-8 text-center">
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
          <TableHead>Quelle</TableHead>
          <TableHead class="w-28">Status</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Budget</TableHead>
          <TableHead class="w-10"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <template v-for="row in rows" :key="row.id">
          <!-- Regular transaction row -->
          <TableRow
            v-if="row.rowType === 'transaction'"
            class="group/row"
            :class="{ 'opacity-60': row.isArchived }"
          >
            <!-- Checkbox -->
            <TableCell
              class="cursor-pointer"
              @click="
                (e: MouseEvent) => emit('toggle-select', row.id, e.shiftKey)
              "
            >
              <Checkbox :model-value="selectedIds.has(row.id)" />
            </TableCell>

            <!-- Date -->
            <TableCell>{{ formatDate(row.bookingDate) }}</TableCell>

            <!-- Note -->
            <TableCell class="px-0">
              <NoteEditor
                :note="row.note"
                :transaction-id="row.id"
                @update:note="(id, note) => emit('update:note', id, note)"
              />
            </TableCell>

            <!-- Description -->
            <TableCell>
              <div>
                <TooltipProvider v-if="row.counterparty ?? row.description">
                  <Tooltip>
                    <span class="flex items-center gap-2">
                      <TooltipTrigger as-child>
                        <span class="max-w-[240px] truncate font-medium">{{
                          row.counterparty ?? row.description
                        }}</span>
                      </TooltipTrigger>
                      <Badge v-if="row.isArchived" variant="outline"
                        >Archiviert</Badge
                      >
                    </span>
                    <TooltipContent v-if="row.note">
                      <p class="max-w-64">
                        {{
                          row.note.length > 100
                            ? row.note.slice(0, 100) + '…'
                            : row.note
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
                  row.amountCents >= 0
                    ? 'text-lime-600 dark:text-lime-400'
                    : 'text-rose-600 dark:text-rose-400'
                "
              >
                {{ formatAmount(row.amountCents) }}
              </span>
            </TableCell>

            <!-- Source -->
            <TableCell>
              <span class="text-muted-foreground text-sm">{{
                row.sourceName || '-'
              }}</span>
            </TableCell>

            <!-- Status -->
            <TableCell>
              <Badge :variant="statusVariant(row.status)">
                {{ statusLabel(row.status) }}
              </Badge>
            </TableCell>

            <!-- Plan -->
            <TableCell>
              <PlanPicker
                :plans="plans"
                :plan-id="row.planId"
                :plan-name="row.planName"
                :plan-date="row.planDate"
                @select="emit('update:plan', row.id, $event)"
              />
            </TableCell>

            <!-- Budget -->
            <TableCell>
              <BudgetPicker
                :plan-id="row.planId"
                :budget-id="row.budgetId"
                :budget-name="row.budgetName"
                @select="
                  (id: string | null, name: string | null) =>
                    emit('update:budget', row.id, id, name)
                "
              />
            </TableCell>

            <!-- Actions -->
            <TableCell>
              <DropdownMenu v-if="!row.isArchived && !row.isSplit">
                <DropdownMenuTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-8 opacity-0 group-hover/row:opacity-100"
                  >
                    <MoreVertical class="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="emit('open-split', row)">
                    <Split class="mr-2 size-4" />
                    Aufteilen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>

          <!-- Split child row -->
          <TableRow
            v-else
            class="group/row border-l-2 border-l-blue-400/50"
            :class="{ 'opacity-60': row.isArchived }"
          >
            <!-- Checkbox -->
            <TableCell
              class="cursor-pointer"
              @click="
                (e: MouseEvent) => emit('toggle-select', row.id, e.shiftKey)
              "
            >
              <Checkbox :model-value="selectedIds.has(row.id)" />
            </TableCell>

            <!-- Date -->
            <TableCell>
              {{ formatDate(row.bookingDate) }}
            </TableCell>

            <!-- No note for splits -->
            <TableCell class="px-0"></TableCell>

            <!-- Description with split icon -->
            <TableCell>
              <div class="flex items-center gap-2">
                <GitBranch class="text-muted-foreground size-4 shrink-0" />
                <span class="max-w-[240px] truncate font-medium">
                  {{ row.label || row.counterparty || row.description || '-' }}
                </span>
                <Badge v-if="row.isArchived" variant="outline"
                  >Archiviert</Badge
                >
              </div>
            </TableCell>

            <!-- Amount -->
            <TableCell>
              <span
                :class="
                  row.amountCents >= 0
                    ? 'text-lime-600 dark:text-lime-400'
                    : 'text-rose-600 dark:text-rose-400'
                "
              >
                {{ formatAmount(row.amountCents) }}
              </span>
            </TableCell>

            <!-- Source -->
            <TableCell>
              <span class="text-muted-foreground text-sm">{{
                row.sourceName || '-'
              }}</span>
            </TableCell>

            <!-- Status -->
            <TableCell>
              <Badge :variant="statusVariant(row.status)">
                {{ statusLabel(row.status) }}
              </Badge>
            </TableCell>

            <!-- Plan (per-split) -->
            <TableCell>
              <PlanPicker
                :plans="plans"
                :plan-id="row.planId"
                :plan-name="row.planName"
                :plan-date="row.planDate"
                @select="emit('update:plan', row.id, $event)"
              />
            </TableCell>

            <!-- Budget (per-split) -->
            <TableCell>
              <BudgetPicker
                :plan-id="row.planId"
                :budget-id="row.budgetId"
                :budget-name="row.budgetName"
                @select="
                  (id: string | null, name: string | null) =>
                    emit('update:budget', row.id, id, name)
                "
              />
            </TableCell>

            <!-- Actions -->
            <TableCell>
              <DropdownMenu v-if="row.parentId && !row.isArchived">
                <DropdownMenuTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-8 opacity-0 group-hover/row:opacity-100"
                  >
                    <MoreVertical class="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="emit('undo-split', row.parentId!)">
                    <Undo2 class="mr-2 size-4" />
                    Aufteilung aufheben
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        </template>
      </TableBody>
    </Table>
  </div>
</template>
