<script setup lang="ts">
import { ref } from 'vue'
import type { Plan } from '@/lib/plans'
import { getPlanDisplayName } from '@/lib/format'
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

const props = defineProps<{
  plans: Plan[]
  planId: string | null
  planName: string | null
  planDate: string | null
}>()

const emit = defineEmits<{
  select: [planId: string | null]
}>()

const open = ref(false)

function handleSelect(selectedPlanId: string | null) {
  if (selectedPlanId !== props.planId) {
    emit('select', selectedPlanId)
  }
  open.value = false
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        class="inline-flex items-center gap-1 rounded-md text-sm transition-colors"
        :class="
          planId
            ? 'hover:underline'
            : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 border border-dashed px-1.5 py-0.5'
        "
      >
        <template v-if="planId">
          {{ getPlanDisplayName(planName, planDate) }}
        </template>
        <template v-else>
          Zuweisen
          <ChevronsUpDown class="size-3" />
        </template>
      </button>
    </PopoverTrigger>
    <PopoverContent class="w-[250px] p-0" align="start">
      <Command>
        <CommandInput placeholder="Plan suchen..." />
        <CommandList>
          <CommandEmpty>Kein Plan gefunden.</CommandEmpty>
          <CommandGroup>
            <CommandItem value="__kein_plan__" @select="handleSelect(null)">
              <Check
                class="mr-2 size-4"
                :class="planId === null ? 'opacity-100' : 'opacity-0'"
              />
              Kein Plan
            </CommandItem>
            <CommandItem
              v-for="p in plans"
              :key="p.id"
              :value="getPlanDisplayName(p.name, p.date)"
              @select="handleSelect(p.id)"
            >
              <Check
                class="mr-2 size-4"
                :class="planId === p.id ? 'opacity-100' : 'opacity-0'"
              />
              {{ getPlanDisplayName(p.name, p.date) }}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
