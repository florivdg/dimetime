<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Category } from '@/lib/categories'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChevronDown,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-vue-next'

export interface FilterState {
  search: string
  categoryId: string | null
  type: 'income' | 'expense' | null
  isDone: boolean | null
  dateFrom: string
  dateTo: string
  amountMin: string
  amountMax: string
}

defineProps<{
  categories: Category[]
}>()

const filters = defineModel<FilterState>('filters', {
  default: () => ({
    search: '',
    categoryId: null,
    type: null,
    isDone: null,
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
  }),
})

const emit = defineEmits<{
  reset: []
}>()

const isAdvancedOpen = ref(false)

const advancedFilterCount = computed(() => {
  let count = 0
  if (filters.value.type !== null) count++
  if (filters.value.isDone !== null) count++
  if (filters.value.dateFrom !== '') count++
  if (filters.value.dateTo !== '') count++
  if (filters.value.amountMin !== '') count++
  if (filters.value.amountMax !== '') count++
  return count
})

const hasActiveFilters = computed(() => {
  return (
    filters.value.search !== '' ||
    filters.value.categoryId !== null ||
    advancedFilterCount.value > 0
  )
})

function setType(type: 'income' | 'expense' | null) {
  filters.value.type = type
}

function setStatus(isDone: boolean | null) {
  filters.value.isDone = isDone
}

function resetFilters() {
  filters.value = {
    search: '',
    categoryId: null,
    type: null,
    isDone: null,
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
  }
  emit('reset')
}
</script>

<template>
  <Collapsible v-model:open="isAdvancedOpen" class="space-y-4">
    <!-- Row 1: Search, Category, and Advanced Toggle -->
    <div class="flex flex-wrap items-center gap-4">
      <div class="min-w-[200px] flex-1">
        <Label for="filter-search" class="sr-only">Suchen</Label>
        <div class="relative">
          <Search
            class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            id="filter-search"
            v-model="filters.search"
            type="search"
            placeholder="Transaktion suchen..."
            class="pl-9"
          />
        </div>
      </div>

      <div class="w-[180px]">
        <Label for="filter-category" class="sr-only">Kategorie</Label>
        <Select v-model="filters.categoryId">
          <SelectTrigger id="filter-category">
            <SelectValue placeholder="Alle Kategorien" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="null">Alle Kategorien</SelectItem>
            <SelectItem v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <CollapsibleTrigger as-child>
        <Button variant="outline" class="gap-2">
          <SlidersHorizontal class="size-4" />
          Erweiterte Filter
          <span
            v-if="advancedFilterCount > 0 && !isAdvancedOpen"
            class="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full text-xs font-medium"
          >
            {{ advancedFilterCount }}
          </span>
          <ChevronDown
            class="size-4 transition-transform duration-200"
            :class="{ 'rotate-180': isAdvancedOpen }"
          />
        </Button>
      </CollapsibleTrigger>

      <Button
        variant="outline"
        size="icon"
        title="Filter zurücksetzen"
        :disabled="!hasActiveFilters"
        @click="resetFilters"
      >
        <RotateCcw class="size-4" />
      </Button>
    </div>

    <!-- Advanced Filters (Collapsible) -->
    <CollapsibleContent>
      <div class="bg-muted/50 space-y-4 rounded-lg border p-4">
        <!-- Type and Status -->
        <div class="flex flex-wrap gap-4">
          <div>
            <Label class="text-muted-foreground mb-1.5 block text-xs"
              >Typ</Label
            >
            <div class="bg-background flex rounded-md border">
              <Button
                variant="ghost"
                size="sm"
                class="rounded-r-none border-r"
                :class="{ 'bg-accent': filters.type === null }"
                @click="setType(null)"
              >
                Alle
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="rounded-none border-r"
                :class="{ 'bg-accent': filters.type === 'income' }"
                @click="setType('income')"
              >
                Einnahmen
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="rounded-l-none"
                :class="{ 'bg-accent': filters.type === 'expense' }"
                @click="setType('expense')"
              >
                Ausgaben
              </Button>
            </div>
          </div>

          <div>
            <Label class="text-muted-foreground mb-1.5 block text-xs"
              >Status</Label
            >
            <div class="bg-background flex rounded-md border">
              <Button
                variant="ghost"
                size="sm"
                class="rounded-r-none border-r"
                :class="{ 'bg-accent': filters.isDone === null }"
                @click="setStatus(null)"
              >
                Alle
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="rounded-none border-r"
                :class="{ 'bg-accent': filters.isDone === false }"
                @click="setStatus(false)"
              >
                Offen
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="rounded-l-none"
                :class="{ 'bg-accent': filters.isDone === true }"
                @click="setStatus(true)"
              >
                Erledigt
              </Button>
            </div>
          </div>
        </div>

        <!-- Date Range and Amount Range -->
        <div class="flex flex-wrap gap-4">
          <div class="flex items-end gap-2">
            <div>
              <Label
                for="filter-date-from"
                class="text-muted-foreground text-xs"
                >Datum von</Label
              >
              <Input
                id="filter-date-from"
                v-model="filters.dateFrom"
                type="date"
                class="bg-background w-[150px]"
              />
            </div>
            <div>
              <Label for="filter-date-to" class="text-muted-foreground text-xs"
                >bis</Label
              >
              <Input
                id="filter-date-to"
                v-model="filters.dateTo"
                type="date"
                class="bg-background w-[150px]"
              />
            </div>
          </div>

          <div class="flex items-end gap-2">
            <div>
              <Label
                for="filter-amount-min"
                class="text-muted-foreground text-xs"
                >Betrag von</Label
              >
              <Input
                id="filter-amount-min"
                v-model="filters.amountMin"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                class="bg-background w-[120px]"
              />
            </div>
            <div>
              <Label
                for="filter-amount-max"
                class="text-muted-foreground text-xs"
                >bis</Label
              >
              <Input
                id="filter-amount-max"
                v-model="filters.amountMax"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                class="bg-background w-[120px]"
              />
            </div>
          </div>
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
