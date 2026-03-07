<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check, ChevronsUpDown } from 'lucide-vue-next'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface Budget {
  id: string
  name: string
}

const props = defineProps<{
  planId: string | null
  budgetId: string | null
  budgetName: string | null
}>()

const emit = defineEmits<{
  select: [budgetId: string | null, budgetName: string | null]
}>()

const open = ref(false)
const budgets = ref<Budget[]>([])
const isLoading = ref(false)

watch(
  () => open.value,
  async (isOpen) => {
    if (isOpen && props.planId) {
      isLoading.value = true
      try {
        const response = await fetch(`/api/plans/${props.planId}/budgets`)
        if (response.ok) {
          const data = await response.json()
          budgets.value = data.budgets
        }
      } catch {
        // Silently ignore
      } finally {
        isLoading.value = false
      }
    }
  },
)

function handleSelect(selectedBudgetId: string | null) {
  if (selectedBudgetId !== props.budgetId) {
    const name =
      budgets.value.find((b) => b.id === selectedBudgetId)?.name ?? null
    emit('select', selectedBudgetId, name)
  }
  open.value = false
}
</script>

<template>
  <span v-if="!planId" class="text-muted-foreground text-sm">-</span>
  <Popover v-else v-model:open="open">
    <PopoverTrigger as-child>
      <button
        class="inline-flex items-center gap-1 rounded-md text-sm transition-colors"
        :class="
          budgetId
            ? 'hover:underline'
            : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 border border-dashed px-1.5 py-0.5'
        "
      >
        <template v-if="budgetId">
          {{ budgetName }}
        </template>
        <template v-else>
          Zuweisen
          <ChevronsUpDown class="size-3" />
        </template>
      </button>
    </PopoverTrigger>
    <PopoverContent class="w-[250px] p-0" align="start">
      <Command>
        <CommandInput placeholder="Budget suchen..." />
        <CommandList>
          <CommandEmpty>
            {{ isLoading ? 'Laden...' : 'Kein Budget gefunden.' }}
          </CommandEmpty>
          <CommandGroup>
            <CommandItem value="__kein_budget__" @select="handleSelect(null)">
              <Check
                class="mr-2 size-4"
                :class="budgetId === null ? 'opacity-100' : 'opacity-0'"
              />
              Kein Budget
            </CommandItem>
            <CommandItem
              v-for="b in budgets"
              :key="b.id"
              :value="b.name"
              @select="handleSelect(b.id)"
            >
              <Check
                class="mr-2 size-4"
                :class="budgetId === b.id ? 'opacity-100' : 'opacity-0'"
              />
              {{ b.name }}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
