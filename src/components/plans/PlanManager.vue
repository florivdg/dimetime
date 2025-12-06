<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import type { Plan } from '@/lib/plans'
import { useUrlState } from '@/composables/useUrlState'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { CalendarDays, Search, X } from 'lucide-vue-next'
import { getPlanDisplayName } from '@/lib/format'
import PlanCreateDialog from './PlanCreateDialog.vue'
import PlanTable from './PlanTable.vue'

const props = defineProps<{
  initialPlans: Plan[]
  availableYears: number[]
  initialYear?: number
}>()

// URL-synced filter state
const { state: urlState, reset: resetUrlState } = useUrlState({
  search: { type: 'string', default: '', urlKey: 'q', debounce: 300 },
  hideArchived: { type: 'boolean', default: false, urlKey: 'hide' },
  year: { type: 'string', default: 'all', urlKey: 'year' },
})

// Create synced refs for v-model compatibility
const searchQuery = ref('')
const hideArchived = ref(false)
const selectedYear = ref<string>(props.initialYear?.toString() ?? 'all')

// Flag to prevent infinite sync loops
let isSyncingFromUrl = false

// Helper to extract filter values from urlState
function getFiltersFromUrlState() {
  return {
    search: urlState.search,
    hideArchived: urlState.hideArchived,
    year: urlState.year,
  }
}

// Initialize filters from URL on mount
onMounted(() => {
  isSyncingFromUrl = true
  const urlFilters = getFiltersFromUrlState()
  searchQuery.value = urlFilters.search
  hideArchived.value = urlFilters.hideArchived
  // Only use URL year if it's not the default, otherwise use initialYear
  if (urlFilters.year !== 'all' || !props.initialYear) {
    selectedYear.value = urlFilters.year
  }
  // Sync the initial year back to urlState if it was set from props
  if (props.initialYear && urlFilters.year === 'all') {
    urlState.year = selectedYear.value
  }
  isSyncingFromUrl = false
})

// Sync local refs → urlState (when user changes filters in UI)
watch(
  [searchQuery, hideArchived, selectedYear],
  ([newSearch, newHide, newYear]) => {
    if (isSyncingFromUrl) return
    urlState.search = newSearch
    urlState.hideArchived = newHide
    urlState.year = newYear
  },
)

// Trigger API reload when year or hideArchived changes from UI
watch([hideArchived, selectedYear], () => {
  if (isSyncingFromUrl) return
  loadPlans()
})

// Sync urlState → local refs and reload data (for browser back/forward)
watch(
  () => ({ ...urlState }),
  () => {
    isSyncingFromUrl = true
    searchQuery.value = urlState.search
    hideArchived.value = urlState.hideArchived
    selectedYear.value = urlState.year
    isSyncingFromUrl = false
    loadPlans()
  },
  { deep: true },
)

// State
const plans = ref<Plan[]>(props.initialPlans)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const isCreateDialogOpen = ref(false)

// Computed
const filteredPlans = computed(() => {
  let result = plans.value

  // Filter by archived status
  if (hideArchived.value) {
    result = result.filter((p) => !p.isArchived)
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter((p) => {
      const displayName = getPlanDisplayName(p.name, p.date).toLowerCase()
      const notes = p.notes?.toLowerCase() ?? ''
      return displayName.includes(query) || notes.includes(query)
    })
  }

  return result
})

const hasActiveFilters = computed(
  () => searchQuery.value !== '' || selectedYear.value !== 'all',
)

// API
async function loadPlans() {
  isLoading.value = true
  errorMessage.value = null
  try {
    const params = new URLSearchParams()
    if (!hideArchived.value) {
      params.set('includeArchived', 'true')
    }
    params.set('year', selectedYear.value)
    const response = await fetch(`/api/plans?${params.toString()}`)
    if (!response.ok) throw new Error('Fehler beim Laden')
    const data = await response.json()
    plans.value = data.plans
  } catch {
    errorMessage.value = 'Pläne konnten nicht geladen werden.'
  } finally {
    isLoading.value = false
  }
}

// Event handlers
function handleCreated() {
  loadPlans()
}

function handleUpdated() {
  loadPlans()
}

function handleDeleted() {
  loadPlans()
}

function handleError(message: string) {
  errorMessage.value = message
}

function resetFilters() {
  isSyncingFromUrl = true
  searchQuery.value = ''
  selectedYear.value = 'all'
  isSyncingFromUrl = false
  resetUrlState()
}
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle class="flex items-center gap-2">
            <CalendarDays class="size-5" />
            Pläne
          </CardTitle>
          <CardDescription> Verwalten Sie Ihre Finanzpläne. </CardDescription>
        </div>
        <PlanCreateDialog
          v-model:open="isCreateDialogOpen"
          @created="handleCreated"
          @error="handleError"
        />
      </div>
    </CardHeader>
    <CardContent>
      <div
        v-if="errorMessage"
        class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm"
      >
        {{ errorMessage }}
      </div>

      <!-- Search and Filter -->
      <div class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div class="relative flex-1">
          <Search
            class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            name="query"
            v-model="searchQuery"
            placeholder="Pläne durchsuchen..."
            class="pl-9"
            @keyup.escape="searchQuery = ''"
          />
        </div>
        <Select v-model="selectedYear">
          <SelectTrigger class="w-[140px]">
            <SelectValue placeholder="Jahr" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Jahre</SelectItem>
            <SelectItem
              v-for="year in availableYears"
              :key="year"
              :value="year.toString()"
            >
              {{ year }}
            </SelectItem>
          </SelectContent>
        </Select>
        <div class="flex items-center gap-2">
          <Switch id="hide-archived" v-model="hideArchived" />
          <Label for="hide-archived" class="cursor-pointer text-sm">
            Archivierte ausblenden
          </Label>
        </div>
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

      <PlanTable
        :plans="filteredPlans"
        :is-loading="isLoading"
        :search-query="searchQuery"
        @updated="handleUpdated"
        @deleted="handleDeleted"
        @error="handleError"
      />
    </CardContent>
  </Card>
</template>
