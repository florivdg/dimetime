<script setup lang="ts">
import { ref } from 'vue'
import type { Plan } from '@/lib/plans'
import { getPlanDisplayName } from '@/lib/format'
import { Check } from 'lucide-vue-next'
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
        class="text-left text-sm hover:underline"
        :class="planId ? '' : 'text-muted-foreground'"
      >
        {{ planId ? getPlanDisplayName(planName, planDate) : '-' }}
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
