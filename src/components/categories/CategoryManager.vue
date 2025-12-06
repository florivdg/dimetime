<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Category } from '@/lib/categories'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search, Sparkles, Tags } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import CategoryCreateDialog from './CategoryCreateDialog.vue'
import CategoryTable from './CategoryTable.vue'

const props = defineProps<{
  initialCategories: Category[]
}>()

// State
const categories = ref<Category[]>(props.initialCategories)
const searchQuery = ref('')
const isLoading = ref(false)
const isSeeding = ref(false)
const errorMessage = ref<string | null>(null)
const isCreateDialogOpen = ref(false)

// Computed
const hasNoCategories = computed(() => categories.value.length === 0)
const filteredCategories = computed(() => {
  if (!searchQuery.value.trim()) {
    return categories.value
  }
  const query = searchQuery.value.toLowerCase()
  return categories.value.filter(
    (cat) =>
      cat.name.toLowerCase().includes(query) ||
      cat.slug.toLowerCase().includes(query),
  )
})

// API
async function loadCategories() {
  isLoading.value = true
  errorMessage.value = null
  try {
    const response = await fetch('/api/categories')
    if (!response.ok) throw new Error('Fehler beim Laden')
    const data = await response.json()
    categories.value = data.categories
  } catch {
    errorMessage.value = 'Kategorien konnten nicht geladen werden.'
  } finally {
    isLoading.value = false
  }
}

async function seedCategories() {
  isSeeding.value = true
  errorMessage.value = null
  try {
    const response = await fetch('/api/categories/seed', { method: 'POST' })
    if (!response.ok)
      throw new Error('Fehler beim Laden der Standardkategorien')
    await loadCategories()
  } catch {
    errorMessage.value = 'Standardkategorien konnten nicht geladen werden.'
  } finally {
    isSeeding.value = false
  }
}

// Event handlers
function handleCreated() {
  loadCategories()
}

function handleUpdated() {
  loadCategories()
}

function handleDeleted() {
  loadCategories()
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
            <Tags class="size-5" />
            Kategorien
          </CardTitle>
          <CardDescription>
            Verwalten Sie Ihre Kategorien für Transaktionen.
          </CardDescription>
        </div>
        <div class="flex gap-2">
          <Button
            v-if="hasNoCategories"
            variant="outline"
            :disabled="isSeeding"
            @click="seedCategories"
          >
            <Sparkles class="size-4" />
            Standardkategorien
          </Button>
          <CategoryCreateDialog
            v-model:open="isCreateDialogOpen"
            @created="handleCreated"
            @error="handleError"
          />
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <div
        v-if="errorMessage"
        class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm"
      >
        {{ errorMessage }}
      </div>

      <!-- Search -->
      <div class="relative mb-4">
        <Search
          class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          name="query"
          v-model="searchQuery"
          placeholder="Kategorien durchsuchen..."
          class="pl-9"
          @keyup.escape="searchQuery = ''"
        />
      </div>

      <CategoryTable
        :categories="filteredCategories"
        :is-loading="isLoading"
        :search-query="searchQuery"
        @updated="handleUpdated"
        @deleted="handleDeleted"
        @error="handleError"
      />
    </CardContent>
  </Card>
</template>
