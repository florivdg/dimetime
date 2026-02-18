<script setup lang="ts">
import { ref } from 'vue'
import type {
  BankTransactionWithRelations,
  ImportSource,
} from '@/lib/bank-transactions'
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
import { Landmark, Search, Upload, X } from 'lucide-vue-next'
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
}>()

const filters = useBankTransactionFilters()
const {
  transactions,
  pagination,
  sources,
  isLoading,
  errorMessage,
  loadTransactions,
  loadSources,
} = useBankTransactions(filters, {
  transactions: props.initialTransactions,
  pagination: props.initialPagination,
  sources: props.initialSources,
})

const importDialogOpen = ref(false)

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

function handleImported() {
  loadTransactions()
  loadSources()
}

function handleSourceCreated(source: ImportSource) {
  sources.value = [source, ...sources.value]
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
      <div class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div class="relative flex-1">
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
        <Select v-model="filters.sourceId.value">
          <SelectTrigger class="w-[180px]">
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
        <Input
          v-model="filters.dateFrom.value"
          type="date"
          class="w-[150px]"
          placeholder="Von"
        />
        <Input
          v-model="filters.dateTo.value"
          type="date"
          class="w-[150px]"
          placeholder="Bis"
        />
        <Button
          variant="outline"
          size="icon"
          title="Filter zurücksetzen"
          :disabled="!filters.hasActiveFilters.value"
          @click="filters.resetFilters"
        >
          <X class="size-4" />
        </Button>
      </div>

      <!-- Table -->
      <BankTransactionTable
        :transactions="transactions"
        :is-loading="isLoading"
        :search-query="filters.search.value"
        :sort-by="filters.sortBy.value"
        :sort-dir="filters.sortDir.value"
        :has-active-filters="filters.hasActiveFilters.value"
        @sort="handleSort"
      />

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
        @source-created="handleSourceCreated"
      />
    </CardContent>
  </Card>
</template>
