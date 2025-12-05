<script setup lang="ts">
import { ref, watch } from 'vue'
import type { TransactionWithCategory } from '@/lib/transactions'
import type { Category } from '@/lib/categories'
import type { Plan } from '@/lib/plans'
import type { PlanBalance } from '@/lib/transactions'
import type { FilterState } from './PlanTransactionFilters.vue'
import PlanBalanceHeader from './PlanBalanceHeader.vue'
import PlanTransactionFilters from './PlanTransactionFilters.vue'
import PlanTransactionTable from './PlanTransactionTable.vue'
import TransactionEditDialog from '@/components/transactions/TransactionEditDialog.vue'
import TransactionCreateDialog from '@/components/transactions/TransactionCreateDialog.vue'
import { toast } from 'vue-sonner'

const props = defineProps<{
  plan: Plan
  initialTransactions: TransactionWithCategory[]
  initialBalance: PlanBalance
  categories: Category[]
}>()

// State
const transactions = ref<TransactionWithCategory[]>(props.initialTransactions)
const balance = ref<PlanBalance>(props.initialBalance)
const sortBy = ref<'name' | 'dueDate' | 'categoryName' | 'amount'>('dueDate')
const sortDir = ref<'asc' | 'desc'>('desc')
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

// Filter state
const filters = ref<FilterState>({
  search: '',
  categoryId: null,
  type: null,
  isDone: null,
  dateFrom: '',
  dateTo: '',
  amountMin: '',
  amountMax: '',
})

// Edit dialog state
const editDialogOpen = ref(false)
const selectedTransaction = ref<TransactionWithCategory | null>(null)

// Create dialog state
const createDialogOpen = ref(false)

// Debounced search watcher
let searchTimeout: ReturnType<typeof setTimeout>
watch(
  () => filters.value.search,
  () => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      loadTransactions()
    }, 300)
  },
)

// Immediate watchers for other filters
watch(
  () => [
    filters.value.categoryId,
    filters.value.type,
    filters.value.isDone,
    filters.value.dateFrom,
    filters.value.dateTo,
    filters.value.amountMin,
    filters.value.amountMax,
  ],
  () => {
    loadTransactions()
  },
)

watch([sortBy, sortDir], () => {
  loadTransactions()
})

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

async function handleToggleDone(id: string, isDone: boolean) {
  // Find transaction and store original state for potential rollback
  const index = transactions.value.findIndex((t) => t.id === id)
  if (index === -1) return

  const originalValue = transactions.value[index].isDone

  // Optimistically update UI immediately
  transactions.value[index].isDone = isDone

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
    transactions.value[index].isDone = originalValue
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
    sortDir.value = column === 'dueDate' ? 'desc' : 'asc'
  }
}

function handleFilterReset() {
  loadTransactions()
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
        <TransactionCreateDialog
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
  </div>
</template>
