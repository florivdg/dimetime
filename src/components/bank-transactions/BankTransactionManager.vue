<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  BankTransactionWithRelations,
  ImportSource,
} from '@/lib/bank-transactions'
import type { Plan } from '@/lib/plans'
import { getPlanDisplayName } from '@/lib/format'
import { toast } from 'vue-sonner'
import { useBankTransactionFilters } from '@/composables/useBankTransactionFilters'
import { useBankTransactions } from '@/composables/useBankTransactions'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  Landmark,
  Search,
  Upload,
  Wallet,
  X,
} from 'lucide-vue-next'
import BankTransactionTable from './BankTransactionTable.vue'
import BankImportDialog from './BankImportDialog.vue'

const props = defineProps<{
  initialTransactions: BankTransactionWithRelations[]
  initialPagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  initialSources: ImportSource[]
  initialPlans: Plan[]
}>()

const filters = useBankTransactionFilters()
const {
  transactions,
  pagination,
  sources,
  plans,
  isLoading,
  errorMessage,
  loadTransactions,
  loadSources,
  updateTransactionPlan,
  updateTransactionNote,
  updateTransactionBudget,
  bulkArchiveTransactions,
  bulkAssignPlan,
  bulkAssignBudget,
} = useBankTransactions(filters, {
  transactions: props.initialTransactions,
  pagination: props.initialPagination,
  sources: props.initialSources,
  plans: props.initialPlans,
})

const importDialogOpen = ref(false)
const bulkPlanPopoverOpen = ref(false)
const bulkBudgetPopoverOpen = ref(false)
const bulkBudgetPlanId = ref<string | null>(null)
const bulkBudgetList = ref<{ id: string; name: string }[]>([])
const bulkBudgetLoading = ref(false)
const activePlans = computed(() => plans.value.filter((p) => !p.isArchived))

const selectedSharedPlanId = computed(() => {
  if (selectedIds.value.size === 0) return null
  const ids = Array.from(selectedIds.value)
  const selectedTxs = transactions.value.filter((tx) => ids.includes(tx.id))
  const planIds = new Set(selectedTxs.map((tx) => tx.planId).filter(Boolean))
  if (planIds.size === 1) return [...planIds][0]!
  return null
})
const selectedIds = ref<Set<string>>(new Set())
const lastSelectedId = ref<string | null>(null)

// Clear selection on filter/page changes
watch(
  () => ({ ...filters.state }),
  () => {
    selectedIds.value = new Set()
    lastSelectedId.value = null
  },
  { deep: true },
)

function toggleSelect(id: string, shiftKey: boolean) {
  const next = new Set(selectedIds.value)
  if (shiftKey && lastSelectedId.value) {
    const txList = transactions.value
    const anchorIdx = txList.findIndex((tx) => tx.id === lastSelectedId.value)
    const currentIdx = txList.findIndex((tx) => tx.id === id)
    if (anchorIdx !== -1 && currentIdx !== -1) {
      const [start, end] = [
        Math.min(anchorIdx, currentIdx),
        Math.max(anchorIdx, currentIdx),
      ]
      for (let i = start; i <= end; i++) {
        next.add(txList[i].id)
      }
    }
  } else {
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
  }
  selectedIds.value = next
  lastSelectedId.value = id
}

function toggleSelectAll() {
  const allSelected = transactions.value.every((tx) =>
    selectedIds.value.has(tx.id),
  )
  if (allSelected) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(transactions.value.map((tx) => tx.id))
  }
}

function clearSelection() {
  selectedIds.value = new Set()
  lastSelectedId.value = null
}

async function handleBulkAssignPlan(planId: string | null) {
  bulkPlanPopoverOpen.value = false
  const ids = Array.from(selectedIds.value)
  if (ids.length === 0) return

  const success = await bulkAssignPlan(ids, planId)
  if (success) {
    toast.success(
      planId
        ? `${ids.length} Transaktion(en) Plan zugewiesen`
        : `${ids.length} Transaktion(en) Plan entfernt`,
    )
    selectedIds.value = new Set()
  } else {
    toast.error('Plan konnte nicht zugewiesen werden.')
  }
}

async function handleBudgetUpdate(
  transactionId: string,
  budgetId: string | null,
  budgetName: string | null,
) {
  const success = await updateTransactionBudget(
    transactionId,
    budgetId,
    budgetName,
  )
  if (success) {
    toast.success(budgetId ? 'Budget zugewiesen' : 'Budget entfernt')
  } else {
    toast.error('Budget konnte nicht aktualisiert werden.')
  }
}

async function openBulkBudgetPopover() {
  bulkBudgetPopoverOpen.value = true
  bulkBudgetPlanId.value = selectedSharedPlanId.value
  await loadBulkBudgets(selectedSharedPlanId.value!)
}

async function loadBulkBudgets(planId: string) {
  bulkBudgetLoading.value = true
  try {
    const response = await fetch(`/api/plans/${planId}/budgets`)
    if (response.ok) {
      const data = await response.json()
      bulkBudgetList.value = data.budgets
    }
  } catch {
    // Silently ignore
  } finally {
    bulkBudgetLoading.value = false
  }
}

async function handleBulkAssignBudget(budgetId: string | null) {
  bulkBudgetPopoverOpen.value = false
  const ids = Array.from(selectedIds.value)
  if (ids.length === 0) return

  // Verify all selected transactions belong to the budget's plan
  if (bulkBudgetPlanId.value) {
    const selectedTxs = transactions.value.filter((tx) => ids.includes(tx.id))
    const wrongPlan = selectedTxs.some(
      (tx) => tx.planId !== bulkBudgetPlanId.value,
    )
    if (wrongPlan) {
      toast.error(
        'Alle Transaktionen müssen zuerst dem gleichen Plan zugewiesen werden.',
      )
      return
    }
  }

  const budgetName =
    bulkBudgetList.value.find((b) => b.id === budgetId)?.name ?? null
  const success = await bulkAssignBudget(ids, budgetId, budgetName)
  if (success) {
    toast.success(
      budgetId
        ? `${ids.length} Transaktion(en) Budget zugewiesen`
        : `${ids.length} Transaktion(en) Budget entfernt`,
    )
    selectedIds.value = new Set()
  } else {
    toast.error('Budget konnte nicht zugewiesen werden.')
  }
}

async function handleBulkArchive(isArchived: boolean) {
  const ids = Array.from(selectedIds.value)
  if (ids.length === 0) return

  const success = await bulkArchiveTransactions(ids, isArchived)
  if (success) {
    toast.success(
      isArchived
        ? `${ids.length} Transaktion(en) archiviert`
        : `${ids.length} Transaktion(en) entarchiviert`,
    )
    selectedIds.value = new Set()
  } else {
    toast.error('Archivierung konnte nicht durchgeführt werden.')
  }
}

function handleSort(column: 'bookingDate' | 'amountCents' | 'createdAt') {
  if (filters.sortBy.value === column) {
    filters.sortDir.value = filters.sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    filters.sortBy.value = column
    filters.sortDir.value = column === 'bookingDate' ? 'desc' : 'asc'
  }
}

function handlePageChange(page: number) {
  filters.page.value = page
}

async function handlePlanUpdate(transactionId: string, planId: string | null) {
  const success = await updateTransactionPlan(transactionId, planId)
  if (success) {
    toast.success(planId ? 'Plan zugewiesen' : 'Plan entfernt')
  } else {
    toast.error('Plan konnte nicht aktualisiert werden.')
  }
}

async function handleNoteUpdate(transactionId: string, note: string | null) {
  const success = await updateTransactionNote(transactionId, note)
  if (success) {
    toast.success(note ? 'Notiz gespeichert' : 'Notiz entfernt')
  } else {
    toast.error('Notiz konnte nicht gespeichert werden.')
  }
}

function handleImported() {
  loadTransactions()
  loadSources()
}
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle class="flex items-center gap-2">
            <Landmark class="size-5" />
            Kontoauszüge
          </CardTitle>
          <CardDescription>
            Importierte Transaktionen aus Bankauszügen.
          </CardDescription>
        </div>
        <Button @click="importDialogOpen = true">
          <Upload class="mr-2 size-4" />
          Import
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      <!-- Error message -->
      <div
        v-if="errorMessage"
        class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm"
      >
        {{ errorMessage }}
      </div>

      <!-- Filters -->
      <div class="mb-4 space-y-3">
        <div class="relative w-full">
          <Search
            class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            v-model="filters.search.value"
            name="search"
            placeholder="Suche in Beschreibung..."
            class="pl-9"
            @keyup.escape="filters.search.value = ''"
          />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Select v-model="filters.sourceId.value">
            <SelectTrigger class="w-[150px]">
              <SelectValue placeholder="Quelle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Quellen</SelectItem>
              <SelectItem
                v-for="source in sources.filter((s) => s.isActive)"
                :key="source.id"
                :value="source.id"
              >
                {{ source.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="filters.status.value">
            <SelectTrigger class="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="booked">Gebucht</SelectItem>
              <SelectItem value="pending">Ausstehend</SelectItem>
              <SelectItem value="unknown">Unbekannt</SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="filters.planId.value">
            <SelectTrigger class="w-[150px]">
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Pläne</SelectItem>
              <SelectItem v-for="p in plans" :key="p.id" :value="p.id">
                {{ getPlanDisplayName(p.name, p.date) }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Input
            v-model="filters.dateFrom.value"
            type="date"
            class="w-[130px]"
            placeholder="Von"
          />
          <Input
            v-model="filters.dateTo.value"
            type="date"
            class="w-[130px]"
            placeholder="Bis"
          />
          <div class="flex items-center gap-2">
            <Switch
              id="show-archived"
              :model-value="filters.showArchived.value"
              @update:model-value="filters.showArchived.value = $event"
            />
            <Label for="show-archived" class="text-sm whitespace-nowrap"
              >Archivierte zeigen</Label
            >
          </div>
          <Button
            variant="outline"
            size="icon"
            title="Filter zurücksetzen"
            class="ml-auto"
            :disabled="!filters.hasActiveFilters.value"
            @click="filters.resetFilters"
          >
            <X class="size-4" />
          </Button>
        </div>
      </div>

      <!-- Table -->
      <BankTransactionTable
        :transactions="transactions"
        :plans="plans"
        :is-loading="isLoading"
        :search-query="filters.search.value"
        :sort-by="filters.sortBy.value"
        :sort-dir="filters.sortDir.value"
        :has-active-filters="filters.hasActiveFilters.value"
        :selected-ids="selectedIds"
        @sort="handleSort"
        @update:plan="handlePlanUpdate"
        @update:budget="handleBudgetUpdate"
        @update:note="handleNoteUpdate"
        @toggle-select="toggleSelect"
        @toggle-select-all="toggleSelectAll"
      />

      <!-- Floating action bar -->
      <div
        v-if="selectedIds.size > 0"
        class="bg-background/80 sticky bottom-0 z-10 mt-4 flex items-center gap-3 rounded-md border px-4 py-3 shadow-md backdrop-blur-sm"
      >
        <span class="text-sm font-medium">
          {{ selectedIds.size }} ausgewählt
        </span>
        <Button size="sm" @click="handleBulkArchive(true)">
          <Archive class="mr-2 size-4" />
          Archivieren
        </Button>
        <Button
          v-if="filters.showArchived.value"
          size="sm"
          variant="outline"
          @click="handleBulkArchive(false)"
        >
          <ArchiveRestore class="mr-2 size-4" />
          Entarchivieren
        </Button>
        <Popover v-model:open="bulkPlanPopoverOpen">
          <PopoverTrigger as-child>
            <Button size="sm" variant="outline">
              <CalendarDays class="mr-2 size-4" />
              Plan zuweisen
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-[250px] p-0" side="top" align="start">
            <Command>
              <CommandInput placeholder="Plan suchen..." />
              <CommandList>
                <CommandEmpty>Kein Plan gefunden.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="__kein_plan__"
                    @select="handleBulkAssignPlan(null)"
                  >
                    Kein Plan
                  </CommandItem>
                  <CommandItem
                    v-for="p in activePlans"
                    :key="p.id"
                    :value="getPlanDisplayName(p.name, p.date)"
                    @select="handleBulkAssignPlan(p.id)"
                  >
                    {{ getPlanDisplayName(p.name, p.date) }}
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Popover v-model:open="bulkBudgetPopoverOpen">
          <PopoverTrigger as-child>
            <Button
              size="sm"
              variant="outline"
              :disabled="!selectedSharedPlanId"
              @click="openBulkBudgetPopover"
            >
              <Wallet class="mr-2 size-4" />
              Budget zuweisen
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-[280px] p-0" side="top" align="start">
            <div class="p-0">
              <Command>
                <CommandInput placeholder="Budget suchen..." />
                <CommandList>
                  <CommandEmpty>
                    {{
                      bulkBudgetLoading ? 'Laden...' : 'Kein Budget gefunden.'
                    }}
                  </CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="__kein_budget__"
                      @select="handleBulkAssignBudget(null)"
                    >
                      Kein Budget
                    </CommandItem>
                    <CommandItem
                      v-for="b in bulkBudgetList"
                      :key="b.id"
                      :value="b.name"
                      @select="handleBulkAssignBudget(b.id)"
                    >
                      {{ b.name }}
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          </PopoverContent>
        </Popover>
        <Button size="sm" variant="ghost" @click="clearSelection">
          <X class="size-4" />
        </Button>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1" class="mt-4">
        <Pagination
          :total="pagination.total"
          :sibling-count="1"
          :items-per-page="pagination.limit"
          :page="filters.page.value"
          show-edges
          @update:page="handlePageChange"
        >
          <PaginationContent v-slot="{ items }">
            <PaginationFirst />
            <PaginationPrevious />
            <template v-for="(item, index) in items">
              <PaginationItem
                v-if="item.type === 'page'"
                :key="index"
                :value="item.value"
                :is-active="item.value === filters.page.value"
              >
                {{ item.value }}
              </PaginationItem>
              <PaginationEllipsis v-else :key="item.type" :index="index" />
            </template>
            <PaginationNext />
            <PaginationLast />
          </PaginationContent>
        </Pagination>
      </div>

      <!-- Import Dialog -->
      <BankImportDialog
        v-model:open="importDialogOpen"
        :sources="sources"
        @imported="handleImported"
      />
    </CardContent>
  </Card>
</template>
