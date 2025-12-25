<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import type { TransactionWithCategory } from '@/lib/transactions'
import type { Category } from '@/lib/categories'
import type { Plan } from '@/lib/plans'
import type { PlanBalance } from '@/lib/transactions'
import type { FilterState } from './PlanTransactionFilters.vue'
import { useUrlState } from '@/composables/useUrlState'

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
import PlanBalanceHeader from './PlanBalanceHeader.vue'
import PlanTransactionFilters from './PlanTransactionFilters.vue'
import PlanTransactionTable from './PlanTransactionTable.vue'
import TransactionEditDialog from '@/components/transactions/TransactionEditDialog.vue'
import TransactionCreateDialog from '@/components/transactions/TransactionCreateDialog.vue'
import TransactionMoveDialog from '@/components/transactions/TransactionMoveDialog.vue'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Lock, Plus } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const props = defineProps<{
  plan: Plan
  initialTransactions: TransactionWithCategory[]
  initialBalance: PlanBalance
  categories: Category[]
}>()

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
    <!-- Balance Header -->
    <PlanBalanceHeader
      :plan-name="plan.name"
      :plan-date="plan.date"
      :income="balance.income"
      :expense="balance.expense"
    />

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
        <!-- Disabled button for archived plans -->
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
        <!-- Create dialog for active plans -->
        <TransactionCreateDialog
          v-else
          v-model:open="createDialogOpen"
          :plan-id="plan.id"
          :categories="categories"
          @created="handleCreated"
          @error="handleError"
        />
      </div>
    </div>

    <!-- Table -->
    <PlanTransactionTable
      :transactions="transactions"
      :is-loading="isLoading"
      :search-query="filters.search"
      :sort-by="sortBy"
      :sort-dir="sortDir"
      @edit="handleEdit"
      @move="handleMove"
      @deleted="handleDeleted"
      @error="handleError"
      @sort="handleSort"
      @toggle-done="handleToggleDone"
    />

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
  </div>
</template>
