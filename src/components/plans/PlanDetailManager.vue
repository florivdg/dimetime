<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import type { TransactionWithCategory } from '@/lib/transactions'
import type { Category } from '@/lib/categories'
import type { Plan } from '@/lib/plans'
import type { PlanBalance } from '@/lib/transactions'
import type { KassensturzSummary } from '@/lib/kassensturz'
import type { FilterState } from './PlanTransactionFilters.vue'
import { useUrlState } from '@/composables/useUrlState'
import { formatAmount, formatDate, getPlanDisplayName } from '@/lib/format'
import { ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-vue-next'

interface UrlStateSchema extends Record<string, unknown> {
  search: string
  categoryId: string | null
  type: 'income' | 'expense' | null
  isDone: boolean | null
  dateFrom: string
  dateTo: string
  amountMin: string
  amountMax: string
  hideZeroValue: boolean
  sortBy: 'name' | 'dueDate' | 'categoryName' | 'amount'
  sortDir: 'asc' | 'desc'
}
import KassensturzSummaryHeader from '@/components/kassensturz/KassensturzSummaryHeader.vue'
import PlanTransactionFilters from './PlanTransactionFilters.vue'
import PlanTransactionTable from './PlanTransactionTable.vue'
import TransactionEditDialog from '@/components/transactions/TransactionEditDialog.vue'
import TransactionCreateDialog from '@/components/transactions/TransactionCreateDialog.vue'
import TransactionMoveDialog from '@/components/transactions/TransactionMoveDialog.vue'
import PresetCreateDialog from '@/components/presets/PresetCreateDialog.vue'
import type { PresetInitialValues } from '@/components/presets/PresetCreateDialog.vue'
import FillFromPresetsDialog from '@/components/presets/FillFromPresetsDialog.vue'
import CopyFromPlanDialog from '@/components/transactions/CopyFromPlanDialog.vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import KassensturzManager from '@/components/kassensturz/KassensturzManager.vue'
import { Copy, FileStack, Lock, MoreVertical, Plus } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const props = defineProps<{
  plan: Plan
  initialTransactions: TransactionWithCategory[]
  initialBalance: PlanBalance
  categories: Category[]
}>()

const activeTab = ref('transaktionen')
const displayName = computed(() =>
  getPlanDisplayName(props.plan.name, props.plan.date),
)
const kassensturzSummary = ref<KassensturzSummary>({
  plannedIncome: 0,
  plannedExpense: 0,
  plannedNet: 0,
  actualIncome: 0,
  actualExpense: 0,
  actualNet: 0,
})

// URL-synced filter and sort state
const { state: urlState, reset: resetUrlState } = useUrlState<UrlStateSchema>({
  search: { type: 'string', default: '', urlKey: 'q', debounce: 300 },
  categoryId: { type: 'nullable-string', default: null, urlKey: 'cat' },
  type: {
    type: 'nullable-enum',
    default: null,
    urlKey: 'type',
    enumValues: ['income', 'expense'] as const,
  },
  isDone: { type: 'nullable-boolean', default: null, urlKey: 'done' },
  dateFrom: { type: 'string', default: '', urlKey: 'from' },
  dateTo: { type: 'string', default: '', urlKey: 'to' },
  amountMin: { type: 'string', default: '', urlKey: 'min' },
  amountMax: { type: 'string', default: '', urlKey: 'max' },
  hideZeroValue: { type: 'boolean', default: true, urlKey: 'hideZero' },
  sortBy: {
    type: 'enum',
    default: 'dueDate' as const,
    urlKey: 'sort',
    enumValues: ['name', 'dueDate', 'categoryName', 'amount'] as const,
  },
  sortDir: {
    type: 'enum',
    default: 'asc' as const,
    urlKey: 'dir',
    enumValues: ['asc', 'desc'] as const,
  },
})

// Create proper ref for v-model compatibility with child's defineModel
const filters = ref<FilterState>({
  search: '',
  categoryId: null,
  type: null,
  isDone: null,
  dateFrom: '',
  dateTo: '',
  amountMin: '',
  amountMax: '',
  hideZeroValue: true,
})

// Flag to prevent infinite sync loops
let isSyncingFromUrl = false

// Helper to extract filter fields from urlState
function getFiltersFromUrlState(): FilterState {
  return {
    search: urlState.search,
    categoryId: urlState.categoryId,
    type: urlState.type,
    isDone: urlState.isDone,
    dateFrom: urlState.dateFrom,
    dateTo: urlState.dateTo,
    amountMin: urlState.amountMin,
    amountMax: urlState.amountMax,
    hideZeroValue: urlState.hideZeroValue,
  }
}

// Initialize filters from URL on mount
onMounted(() => {
  isSyncingFromUrl = true
  filters.value = getFiltersFromUrlState()
  isSyncingFromUrl = false
})

// Sync filters → urlState (when user changes filters in UI)
watch(
  filters,
  (newFilters) => {
    if (isSyncingFromUrl) return
    urlState.search = newFilters.search
    urlState.categoryId = newFilters.categoryId
    urlState.type = newFilters.type
    urlState.isDone = newFilters.isDone
    urlState.dateFrom = newFilters.dateFrom
    urlState.dateTo = newFilters.dateTo
    urlState.amountMin = newFilters.amountMin
    urlState.amountMax = newFilters.amountMax
    urlState.hideZeroValue = newFilters.hideZeroValue
  },
  { deep: true },
)

// Sync urlState → filters (for browser back/forward via popstate)
watch(
  () => ({ ...urlState }),
  () => {
    isSyncingFromUrl = true
    filters.value = getFiltersFromUrlState()
    isSyncingFromUrl = false
    loadTransactions()
  },
  { deep: true },
)

// Direct access to sort properties from reactive state
const sortBy = computed({
  get: () => urlState.sortBy,
  set: (value: 'name' | 'dueDate' | 'categoryName' | 'amount') => {
    urlState.sortBy = value
  },
})

const sortDir = computed({
  get: () => urlState.sortDir,
  set: (value: 'asc' | 'desc') => {
    urlState.sortDir = value
  },
})

// State
const transactions = ref<TransactionWithCategory[]>(props.initialTransactions)
const balance = ref<PlanBalance>(props.initialBalance)
const net = computed(() => balance.value.income - balance.value.expense)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

// Edit dialog state
const editDialogOpen = ref(false)
const selectedTransaction = ref<TransactionWithCategory | null>(null)

// Create dialog state
const createDialogOpen = ref(false)

// Move dialog state
const moveDialogOpen = ref(false)
const transactionToMove = ref<TransactionWithCategory | null>(null)

// Fill from presets dialog state
const fillFromPresetsDialogOpen = ref(false)

// Preset dialog state
const presetDialogOpen = ref(false)
const presetInitialValues = ref<PresetInitialValues | undefined>(undefined)

// Copy from plan dialog state
const copyFromPlanDialogOpen = ref(false)

// API
async function loadTransactions() {
  isLoading.value = true
  errorMessage.value = null
  try {
    const params = new URLSearchParams()
    params.set('planId', props.plan.id)
    if (filters.value.search) params.set('search', filters.value.search)
    if (filters.value.categoryId)
      params.set('categoryId', filters.value.categoryId)
    if (filters.value.type) params.set('type', filters.value.type)
    if (filters.value.isDone !== null)
      params.set('isDone', filters.value.isDone.toString())
    if (filters.value.dateFrom) params.set('dateFrom', filters.value.dateFrom)
    if (filters.value.dateTo) params.set('dateTo', filters.value.dateTo)
    if (filters.value.amountMin) {
      const cents = Math.round(parseFloat(filters.value.amountMin) * 100)
      if (!isNaN(cents)) params.set('amountMin', cents.toString())
    }
    if (filters.value.amountMax) {
      const cents = Math.round(parseFloat(filters.value.amountMax) * 100)
      if (!isNaN(cents)) params.set('amountMax', cents.toString())
    }
    if (!filters.value.hideZeroValue) {
      params.set('hideZeroValue', 'false')
    }
    params.set('sortBy', sortBy.value)
    params.set('sortDir', sortDir.value)
    params.set('limit', '-1')

    const response = await fetch(`/api/transactions?${params.toString()}`)
    if (!response.ok) throw new Error('Fehler beim Laden')
    const data = await response.json()
    transactions.value = data.transactions
  } catch {
    errorMessage.value = 'Transaktionen konnten nicht geladen werden.'
  } finally {
    isLoading.value = false
  }
}

async function loadBalance() {
  try {
    const response = await fetch(`/api/plans/${props.plan.id}/balance`)
    if (!response.ok) return
    const data = await response.json()
    balance.value = data
  } catch {
    // Ignore balance load errors
  }
}

// Event handlers
function handleEdit(transaction: TransactionWithCategory) {
  selectedTransaction.value = transaction
  editDialogOpen.value = true
}

function handleUpdated() {
  loadTransactions()
  loadBalance()
}

function handleMove(transaction: TransactionWithCategory) {
  transactionToMove.value = transaction
  moveDialogOpen.value = true
}

function handleMoved(_targetPlanId: string, targetPlanName: string) {
  // Remove transaction from current list
  transactions.value = transactions.value.filter(
    (t) => t.id !== transactionToMove.value?.id,
  )

  // Show success toast
  toast.success(
    `"${transactionToMove.value?.name}" wurde zu "${targetPlanName}" verschoben`,
  )

  // Reload balance
  loadBalance()

  // Reset
  transactionToMove.value = null
}

async function handleToggleDone(id: string, isDone: boolean) {
  // Check if plan is archived
  if (props.plan.isArchived) {
    toast.error('Transaktion kann nicht geändert werden - Plan ist archiviert')
    return
  }

  // Find transaction and store original state for potential rollback
  const index = transactions.value.findIndex((t) => t.id === id)
  if (index === -1) return

  const originalValue = transactions.value[index].isDone

  // Check if transaction will be filtered out after toggle
  const willBeFilteredOut =
    filters.value.isDone !== null && filters.value.isDone !== isDone

  // Store transaction for potential restoration on error
  const removedTransaction = willBeFilteredOut
    ? { ...transactions.value[index] }
    : null

  // Optimistically update UI immediately
  if (willBeFilteredOut) {
    // Remove from list since it won't match the current filter anymore
    transactions.value.splice(index, 1)
  } else {
    // Just update the isDone property
    transactions.value[index].isDone = isDone
  }

  try {
    const response = await fetch(`/api/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDone }),
    })

    if (!response.ok) {
      throw new Error('Fehler beim Aktualisieren')
    }

    // Success: show toast and reload balance only
    toast.success(isDone ? 'Als erledigt markiert' : 'Als offen markiert')
    loadBalance()
  } catch {
    // Error: revert the optimistic update
    if (willBeFilteredOut && removedTransaction) {
      // Re-insert the removed transaction at original position
      transactions.value.splice(index, 0, removedTransaction)
    } else if (index < transactions.value.length) {
      transactions.value[index].isDone = originalValue
    }
    toast.error('Status konnte nicht aktualisiert werden')
  }
}

function handleCreated() {
  loadTransactions()
  loadBalance()
}

function handleDeleted() {
  loadTransactions()
  loadBalance()
}

function handleError(message: string) {
  errorMessage.value = message
}

function handleSort(column: 'name' | 'dueDate' | 'categoryName' | 'amount') {
  if (sortBy.value === column) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = column
    sortDir.value = 'asc'
  }
}

function handleSaveAsPreset(transaction: TransactionWithCategory) {
  presetInitialValues.value = {
    name: transaction.name,
    note: transaction.note,
    amount: transaction.amount,
    type: transaction.type,
    categoryId: transaction.categoryId,
  }
  presetDialogOpen.value = true
}

function handlePresetCreated() {
  toast.success('Vorlage erstellt')
}

function handleFillFromPresets() {
  fillFromPresetsDialogOpen.value = true
}

function handlePresetsApplied() {
  loadTransactions()
  loadBalance()
}

function handleCopyFromPlan() {
  copyFromPlanDialogOpen.value = true
}

function handleTransactionsCopied() {
  loadTransactions()
  loadBalance()
}

function handleFilterReset() {
  // Reset both urlState and filters ref
  resetUrlState()
  isSyncingFromUrl = true
  filters.value = getFiltersFromUrlState()
  isSyncingFromUrl = false
}
</script>

<template>
  <div class="space-y-6">
    <Tabs v-model="activeTab" default-value="transaktionen">
      <!-- Header: Title left, Tabs right -->
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold">{{ displayName }}</h1>
          <p class="text-muted-foreground text-sm">
            {{ formatDate(plan.date, 'long') }}
          </p>
        </div>
        <TabsList>
          <TabsTrigger value="transaktionen">Transaktionen</TabsTrigger>
          <TabsTrigger value="kassensturz">Kassensturz</TabsTrigger>
        </TabsList>
      </div>

      <!-- Context-dependent Summary Cards -->
      <div
        v-if="activeTab === 'transaktionen'"
        class="grid gap-4 sm:grid-cols-3"
      >
        <!-- Income -->
        <div class="bg-card rounded-lg border p-4">
          <div class="flex items-center gap-3">
            <div class="rounded-full bg-lime-100 p-2 dark:bg-lime-900">
              <ArrowUpCircle class="size-5 text-lime-600 dark:text-lime-400" />
            </div>
            <div>
              <p class="text-muted-foreground text-sm">Einnahmen</p>
              <p class="text-lg font-semibold text-lime-600 dark:text-lime-400">
                {{ formatAmount(balance.income) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Expenses -->
        <div class="bg-card rounded-lg border p-4">
          <div class="flex items-center gap-3">
            <div class="rounded-full bg-rose-100 p-2 dark:bg-rose-900">
              <ArrowDownCircle
                class="size-5 text-rose-600 dark:text-rose-400"
              />
            </div>
            <div>
              <p class="text-muted-foreground text-sm">Ausgaben</p>
              <p class="text-lg font-semibold text-rose-600 dark:text-rose-400">
                {{ formatAmount(balance.expense) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Balance -->
        <div class="bg-card rounded-lg border p-4">
          <div class="flex items-center gap-3">
            <div
              class="rounded-full p-2"
              :class="
                net >= 0
                  ? 'bg-lime-100 dark:bg-lime-900'
                  : 'bg-rose-100 dark:bg-rose-900'
              "
            >
              <Wallet
                class="size-5"
                :class="
                  net >= 0
                    ? 'text-lime-600 dark:text-lime-400'
                    : 'text-rose-600 dark:text-rose-400'
                "
              />
            </div>
            <div>
              <p class="text-muted-foreground text-sm">Saldo</p>
              <p
                class="text-lg font-semibold"
                :class="
                  net >= 0
                    ? 'text-lime-600 dark:text-lime-400'
                    : 'text-rose-600 dark:text-rose-400'
                "
              >
                {{ net >= 0 ? '+' : '' }}{{ formatAmount(net) }}
              </p>
            </div>
          </div>
        </div>
      </div>
      <KassensturzSummaryHeader v-else :summary="kassensturzSummary" />

      <TabsContent value="transaktionen" class="space-y-6">
        <!-- Error message -->
        <div
          v-if="errorMessage"
          class="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
        >
          {{ errorMessage }}
        </div>

        <!-- Filters and Create Button -->
        <div class="space-y-4">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1">
              <PlanTransactionFilters
                v-model:filters="filters"
                :categories="categories"
                @reset="handleFilterReset"
              />
            </div>
            <!-- Disabled buttons for archived plans -->
            <TooltipProvider v-if="plan.isArchived">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button disabled>
                    <Lock class="mr-2 size-4" />
                    Neue Transaktion
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Plan ist archiviert - keine neuen Transaktionen möglich</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <!-- Action buttons for active plans -->
            <div v-else class="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="outline" size="icon">
                    <MoreVertical class="size-4" />
                    <span class="sr-only">Weitere Aktionen</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="handleFillFromPresets">
                    <FileStack class="size-4" />
                    Vorlagen anwenden
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="handleCopyFromPlan">
                    <Copy class="size-4" />
                    Transaktionen kopieren
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <TransactionCreateDialog
                v-model:open="createDialogOpen"
                :plan-id="plan.id"
                :categories="categories"
                @created="handleCreated"
                @error="handleError"
              />
            </div>
          </div>
        </div>

        <!-- Table -->
        <PlanTransactionTable
          :transactions="transactions"
          :is-loading="isLoading"
          :search-query="filters.search"
          :sort-by="sortBy"
          :sort-dir="sortDir"
          :is-archived="plan.isArchived"
          @edit="handleEdit"
          @move="handleMove"
          @deleted="handleDeleted"
          @error="handleError"
          @sort="handleSort"
          @toggle-done="handleToggleDone"
          @fill-from-presets="handleFillFromPresets"
          @save-as-preset="handleSaveAsPreset"
        />
      </TabsContent>

      <TabsContent value="kassensturz">
        <KassensturzManager
          :plan="plan"
          @summary-update="kassensturzSummary = $event"
        />
      </TabsContent>
    </Tabs>

    <!-- Edit Dialog -->
    <TransactionEditDialog
      v-model:open="editDialogOpen"
      :transaction="selectedTransaction"
      :categories="categories"
      @updated="handleUpdated"
      @error="handleError"
    />

    <!-- Move Dialog -->
    <TransactionMoveDialog
      v-model:open="moveDialogOpen"
      :transaction="transactionToMove"
      :current-plan-id="plan.id"
      @moved="handleMoved"
      @error="handleError"
    />

    <!-- Fill from Presets Dialog -->
    <FillFromPresetsDialog
      v-model:open="fillFromPresetsDialogOpen"
      :plan-id="plan.id"
      :plan-date="plan.date"
      @applied="handlePresetsApplied"
      @error="handleError"
    />

    <!-- Copy from Plan Dialog -->
    <CopyFromPlanDialog
      v-model:open="copyFromPlanDialogOpen"
      :plan-id="plan.id"
      :plan-date="plan.date"
      @copied="handleTransactionsCopied"
      @error="handleError"
    />

    <!-- Preset Create Dialog (no trigger, controlled via v-model) -->
    <PresetCreateDialog
      v-model:open="presetDialogOpen"
      :categories="categories"
      :initial-values="presetInitialValues"
      @created="handlePresetCreated"
      @error="handleError"
    />
  </div>
</template>
