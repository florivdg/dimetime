<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useUrlState } from '@/composables/useUrlState'
import type { Category } from '@/lib/categories'
import type { PresetWithTags } from '@/lib/presets'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus, X } from 'lucide-vue-next'
import PresetCreateDialog from './PresetCreateDialog.vue'
import PresetTable from './PresetTable.vue'

const props = defineProps<{
  initialPresets: PresetWithTags[]
  initialPagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  categories: Category[]
}>()

const presets = ref<PresetWithTags[]>(props.initialPresets)
const pagination = ref(props.initialPagination)
const isLoading = ref(false)
const error = ref('')

const { state: urlState, reset: resetFilters } = useUrlState({
  search: { type: 'string', default: '', urlKey: 'q', debounce: 300 },
  categoryId: { type: 'string', default: 'all', urlKey: 'cat' },
  type: {
    type: 'nullable-enum',
    default: null,
    urlKey: 'type',
    enumValues: ['income', 'expense'],
  } as const,
  recurrence: { type: 'string', default: 'all', urlKey: 'rec' },
  includeExpired: { type: 'boolean', default: false, urlKey: 'exp' },
  sortBy: {
    type: 'enum',
    default: 'createdAt' as const,
    urlKey: 'sort',
    enumValues: ['name', 'createdAt', 'lastUsedAt', 'amount'] as const,
  },
  sortDir: {
    type: 'enum',
    default: 'desc' as const,
    urlKey: 'dir',
    enumValues: ['asc', 'desc'] as const,
  },
  page: { type: 'number', default: 1, urlKey: 'page' },
})

const createDialogOpen = ref(false)

const hasActiveFilters = computed(
  () =>
    urlState.search !== '' ||
    urlState.categoryId !== 'all' ||
    urlState.type !== null ||
    urlState.recurrence !== 'all' ||
    urlState.includeExpired !== false,
)

// Watch for URL state changes and reload presets
watch(
  urlState,
  async () => {
    await loadPresets()
  },
  { deep: true },
)

async function loadPresets() {
  isLoading.value = true
  error.value = ''

  try {
    const params = new URLSearchParams()

    if (urlState.search) params.append('search', urlState.search)
    if (urlState.categoryId && urlState.categoryId !== 'all')
      params.append('categoryId', urlState.categoryId)
    if (urlState.type) params.append('type', urlState.type)
    if (urlState.recurrence && urlState.recurrence !== 'all')
      params.append('recurrence', urlState.recurrence)
    params.append('includeExpired', String(urlState.includeExpired))
    params.append('sortBy', urlState.sortBy)
    params.append('sortDir', urlState.sortDir)
    params.append('page', String(urlState.page))
    params.append('limit', String(20))

    const response = await fetch(`/api/presets?${params}`)

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Fehler beim Laden')
    }

    const data = await response.json()
    presets.value = data.presets || []
    pagination.value = data.pagination
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : 'Vorlagen konnten nicht geladen werden.'
  } finally {
    isLoading.value = false
  }
}

function handleSort(column: string) {
  if (urlState.sortBy === column) {
    urlState.sortDir = urlState.sortDir === 'asc' ? 'desc' : 'asc'
  } else {
    urlState.sortBy = column as any
    urlState.sortDir = 'desc'
  }
}

function handlePageChange(page: number) {
  urlState.page = page
}

function handleReset() {
  resetFilters()
}

function showError(message: string) {
  error.value = message
  setTimeout(() => {
    error.value = ''
  }, 5000)
}
</script>

<template>
  <div class="flex flex-1 flex-col gap-4">
    <div
      v-if="error"
      class="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
    >
      {{ error }}
    </div>

    <div class="flex items-center gap-2">
      <div class="flex-1">
        <Input
          v-model="urlState.search"
          type="search"
          placeholder="Vorlagen durchsuchen..."
          class="max-w-sm"
        />
      </div>
      <PresetCreateDialog
        v-model:open="createDialogOpen"
        :categories="categories"
        @created="loadPresets"
        @error="showError"
      >
        <Button>
          <Plus class="size-4" />
          Neue Vorlage
        </Button>
      </PresetCreateDialog>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <Select v-model="urlState.type">
        <SelectTrigger class="w-[160px]">
          <SelectValue placeholder="Typ" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem :value="null">Alle Typen</SelectItem>
          <SelectItem value="income">Einnahmen</SelectItem>
          <SelectItem value="expense">Ausgaben</SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="urlState.categoryId">
        <SelectTrigger class="w-[200px]">
          <SelectValue placeholder="Kategorie" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle Kategorien</SelectItem>
          <SelectItem v-for="cat in categories" :key="cat.id" :value="cat.id">
            {{ cat.name }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="urlState.recurrence">
        <SelectTrigger class="w-[180px]">
          <SelectValue placeholder="Wiederholung" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle</SelectItem>
          <SelectItem value="einmalig">Einmalig</SelectItem>
          <SelectItem value="monatlich">Monatlich</SelectItem>
          <SelectItem value="vierteljährlich">Vierteljährlich</SelectItem>
          <SelectItem value="jährlich">Jährlich</SelectItem>
        </SelectContent>
      </Select>

      <div class="flex items-center gap-2">
        <Switch id="include-expired" v-model="urlState.includeExpired" />
        <Label for="include-expired" class="cursor-pointer text-sm font-normal">
          Abgelaufene anzeigen
        </Label>
      </div>

      <Button
        variant="outline"
        size="icon"
        title="Filter zurücksetzen"
        class="ml-auto"
        :disabled="!hasActiveFilters"
        @click="handleReset"
      >
        <X class="size-4" />
      </Button>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Loader2 class="text-muted-foreground size-6 animate-spin" />
    </div>

    <PresetTable
      v-else
      :presets="presets"
      :categories="categories"
      :sort-by="urlState.sortBy"
      :sort-dir="urlState.sortDir"
      @updated="loadPresets"
      @deleted="loadPresets"
      @applied="loadPresets"
      @error="showError"
      @sort="handleSort"
    />

    <Pagination
      v-if="pagination.totalPages > 1"
      v-slot="{ page }"
      :total="pagination.total"
      :items-per-page="pagination.limit"
      :sibling-count="1"
      show-edges
      :page="pagination.page"
      @update:page="handlePageChange"
    >
      <PaginationContent v-slot="{ items }" class="flex items-center gap-1">
        <PaginationFirst />
        <PaginationPrevious />

        <template v-for="(item, index) in items">
          <PaginationItem
            v-if="item.type === 'page'"
            :key="index"
            :value="item.value"
            as-child
          >
            <Button
              class="size-10 p-0"
              :variant="item.value === page ? 'default' : 'outline'"
            >
              {{ item.value }}
            </Button>
          </PaginationItem>
          <PaginationEllipsis v-else :key="item.type" :index="index" />
        </template>

        <PaginationNext />
        <PaginationLast />
      </PaginationContent>
    </Pagination>
  </div>
</template>
