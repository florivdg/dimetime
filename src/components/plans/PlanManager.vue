<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Plan } from '@/lib/plans'
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
import { CalendarDays, Search } from 'lucide-vue-next'
import PlanCreateDialog from './PlanCreateDialog.vue'
import PlanTable from './PlanTable.vue'

const props = defineProps<{
  initialPlans: Plan[]
}>()

// State
const plans = ref<Plan[]>(props.initialPlans)
const searchQuery = ref('')
const showArchived = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const isCreateDialogOpen = ref(false)

// Watchers
watch(showArchived, () => loadPlans())

// Computed
const filteredPlans = computed(() => {
  let result = plans.value

  // Filter by archived status
  if (!showArchived.value) {
    result = result.filter((p) => !p.isArchived)
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (p) => p.name?.toLowerCase().includes(query) || p.date.includes(query),
    )
  }

  return result
})

// API
async function loadPlans() {
  isLoading.value = true
  errorMessage.value = null
  try {
    const params = new URLSearchParams()
    if (showArchived.value) {
      params.set('includeArchived', 'true')
    }
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
        <div class="flex items-center gap-2">
          <Switch id="show-archived" v-model="showArchived" />
          <Label for="show-archived" class="cursor-pointer text-sm">
            Archivierte anzeigen
          </Label>
        </div>
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
