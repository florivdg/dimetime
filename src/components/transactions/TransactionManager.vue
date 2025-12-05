<script setup lang="ts">
import { ref, watch } from 'vue'
import type { TransactionWithCategory } from '@/lib/transactions'
import type { Category } from '@/lib/categories'
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
import { Receipt, Search } from 'lucide-vue-next'
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
}>()

// State
const transactions = ref<TransactionWithCategory[]>(props.initialTransactions)
const pagination = ref(props.initialPagination)
const searchQuery = ref('')
const selectedCategoryId = ref<string>('all')
const sortBy = ref<'name' | 'dueDate' | 'categoryName' | 'amount'>('dueDate')
const sortDir = ref<'asc' | 'desc'>('desc')
const currentPage = ref(1)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

// Debounced search watcher
let searchTimeout: ReturnType<typeof setTimeout>
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    loadTransactions()
  }, 300)
})

// Immediate watchers for filters
watch([selectedCategoryId, sortBy, sortDir], () => {
  currentPage.value = 1
  loadTransactions()
})

watch(currentPage, () => {
  loadTransactions()
})

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
