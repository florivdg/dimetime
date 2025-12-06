<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import type { TransactionWithCategory } from '@/lib/transactions'
import { useUrlState } from '@/composables/useUrlState'
import type { Category } from '@/lib/categories'
import type { Plan } from '@/lib/plans'
import { getPlanDisplayName } from '@/lib/format'
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
import { Receipt, Search, X } from 'lucide-vue-next'
import TransactionTable from './TransactionTable.vue'

const props = defineProps<{
  initialTransactions: TransactionWithCategory[]
  initialPagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  categories: Category[]
  plans: Plan[]
}>()

// URL-synced filter state
const { state: urlState, reset: resetUrlState } = useUrlState({
  search: { type: 'string', default: '', urlKey: 'q', debounce: 300 },
  categoryId: { type: 'string', default: 'all', urlKey: 'cat' },
  planId: { type: 'string', default: 'all', urlKey: 'plan' },
  sortBy: {
    type: 'enum',
    default: 'dueDate' as const,
    urlKey: 'sort',
    enumValues: ['name', 'dueDate', 'categoryName', 'amount'] as const,
  },
  sortDir: {
    type: 'enum',
    default: 'desc' as const,
    urlKey: 'dir',
    enumValues: ['asc', 'desc'] as const,
  },
  page: { type: 'number', default: 1, urlKey: 'page' },
})

// Create synced refs for v-model compatibility
const searchQuery = ref('')
const selectedCategoryId = ref<string>('all')
const selectedPlanId = ref<string>('all')
const sortBy = ref<'name' | 'dueDate' | 'categoryName' | 'amount'>('dueDate')
const sortDir = ref<'asc' | 'desc'>('desc')
const currentPage = ref(1)

// Flag to prevent infinite sync loops
let isSyncingFromUrl = false

// Helper to extract filter values from urlState
function getFiltersFromUrlState() {
  return {
    search: urlState.search,
    categoryId: urlState.categoryId,
    planId: urlState.planId,
    sortBy: urlState.sortBy,
    sortDir: urlState.sortDir,
    page: urlState.page,
  }
}

// Initialize filters from URL on mount
onMounted(() => {
  isSyncingFromUrl = true
  const urlFilters = getFiltersFromUrlState()
  searchQuery.value = urlFilters.search
  selectedCategoryId.value = urlFilters.categoryId
  selectedPlanId.value = urlFilters.planId
  sortBy.value = urlFilters.sortBy
  sortDir.value = urlFilters.sortDir
  currentPage.value = urlFilters.page
  isSyncingFromUrl = false

  // Load if URL had non-default filters
  if (
    urlFilters.search ||
    urlFilters.categoryId !== 'all' ||
    urlFilters.planId !== 'all' ||
    urlFilters.sortBy !== 'dueDate' ||
    urlFilters.sortDir !== 'desc' ||
    urlFilters.page !== 1
  ) {
    loadTransactions()
  }
})

// Sync local refs → urlState (when user changes filters in UI)
watch(
  [
    searchQuery,
    selectedCategoryId,
    selectedPlanId,
    sortBy,
    sortDir,
    currentPage,
  ],
  ([newSearch, newCat, newPlan, newSortBy, newSortDir, newPage]) => {
    if (isSyncingFromUrl) return
    urlState.search = newSearch
    urlState.categoryId = newCat
    urlState.planId = newPlan
    urlState.sortBy = newSortBy
    urlState.sortDir = newSortDir
    urlState.page = newPage
  },
)

// Sync urlState → local refs and reload data (for browser back/forward)
watch(
  () => ({ ...urlState }),
  () => {
    const urlFilters = getFiltersFromUrlState()

    isSyncingFromUrl = true
    searchQuery.value = urlFilters.search
    selectedCategoryId.value = urlFilters.categoryId
    selectedPlanId.value = urlFilters.planId
    sortBy.value = urlFilters.sortBy
    sortDir.value = urlFilters.sortDir
    currentPage.value = urlFilters.page
    isSyncingFromUrl = false

    loadTransactions()
  },
  { deep: true },
)

// State
const transactions = ref<TransactionWithCategory[]>(props.initialTransactions)
const pagination = ref(props.initialPagination)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

const hasActiveFilters = computed(
  () =>
    searchQuery.value !== '' ||
    selectedCategoryId.value !== 'all' ||
    selectedPlanId.value !== 'all',
)

// API
async function loadTransactions() {
  isLoading.value = true
  errorMessage.value = null
  try {
    const params = new URLSearchParams()
    if (searchQuery.value) params.set('search', searchQuery.value)
    if (selectedCategoryId.value !== 'all') {
      params.set('categoryId', selectedCategoryId.value)
    }
    if (selectedPlanId.value !== 'all') {
      params.set('planId', selectedPlanId.value)
    }
    params.set('sortBy', sortBy.value)
    params.set('sortDir', sortDir.value)
    params.set('page', currentPage.value.toString())
    params.set('limit', '20')

    const response = await fetch(`/api/transactions?${params.toString()}`)
    if (!response.ok) throw new Error('Fehler beim Laden')
    const data = await response.json()
    transactions.value = data.transactions
    pagination.value = data.pagination
  } catch {
    errorMessage.value = 'Transaktionen konnten nicht geladen werden.'
  } finally {
    isLoading.value = false
  }
}

// Event handlers
function handleUpdated() {
  loadTransactions()
}

function handleDeleted() {
  loadTransactions()
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

function handlePageChange(page: number) {
  currentPage.value = page
}

function resetFilters() {
  // Reset both local refs and URL state
  isSyncingFromUrl = true
  searchQuery.value = ''
  selectedCategoryId.value = 'all'
  selectedPlanId.value = 'all'
  currentPage.value = 1
  isSyncingFromUrl = false
  resetUrlState()
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Receipt class="size-5" />
        Transaktionen
      </CardTitle>
      <CardDescription>
        Alle geplanten Einnahmen und Ausgaben.
      </CardDescription>
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
      <div class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div class="relative flex-1">
          <Search
            class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            v-model="searchQuery"
            name="search"
            placeholder="Nach Name suchen..."
            class="pl-9"
            @keyup.escape="searchQuery = ''"
          />
        </div>
        <Select v-model="selectedCategoryId">
          <SelectTrigger class="w-[180px]">
            <SelectValue placeholder="Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            <SelectItem v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="selectedPlanId">
          <SelectTrigger class="w-[180px]">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Pläne</SelectItem>
            <SelectItem v-for="p in plans" :key="p.id" :value="p.id">
              {{ getPlanDisplayName(p.name, p.date) }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          title="Filter zurücksetzen"
          :disabled="!hasActiveFilters"
          @click="resetFilters"
        >
          <X class="size-4" />
        </Button>
      </div>

      <!-- Table -->
      <TransactionTable
        :transactions="transactions"
        :is-loading="isLoading"
        :search-query="searchQuery"
        :sort-by="sortBy"
        :sort-dir="sortDir"
        :categories="categories"
        @updated="handleUpdated"
        @deleted="handleDeleted"
        @error="handleError"
        @sort="handleSort"
      />

      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1" class="mt-4">
        <Pagination
          :total="pagination.total"
          :sibling-count="1"
          :items-per-page="pagination.limit"
          :page="currentPage"
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
                :is-active="item.value === currentPage"
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
    </CardContent>
  </Card>
</template>
