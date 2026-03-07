<script setup lang="ts">
import { computed } from 'vue'
import { formatAmount } from '@/lib/format'
import { Wallet, AlertTriangle, CircleCheck } from 'lucide-vue-next'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const props = defineProps<{
  budgetedCents: number
  spentCents: number
}>()

type BudgetStatus = 'no-spending' | 'under-budget' | 'at-budget' | 'over-budget'

const status = computed<BudgetStatus>(() => {
  if (props.spentCents <= 0) return 'no-spending'
  if (props.spentCents > props.budgetedCents) return 'over-budget'
  if (props.spentCents === props.budgetedCents) return 'at-budget'
  return 'under-budget'
})

const remaining = computed(() => props.budgetedCents - props.spentCents)

const iconMap = {
  'no-spending': Wallet,
  'under-budget': Wallet,
  'at-budget': CircleCheck,
  'over-budget': AlertTriangle,
} as const

const colorMap = {
  'no-spending': 'border-border bg-secondary text-muted-foreground',
  'under-budget':
    'border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-800 dark:bg-lime-950 dark:text-lime-300',
  'at-budget':
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
  'over-budget':
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300',
} as const
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <span
        :class="[
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
          colorMap[status],
        ]"
      >
        <component :is="iconMap[status]" class="size-3" />
        {{ formatAmount(spentCents) }} / {{ formatAmount(budgetedCents) }}
      </span>
    </TooltipTrigger>
    <TooltipContent>
      <div class="text-xs">
        <div>Budget: {{ formatAmount(budgetedCents) }}</div>
        <div>Ausgegeben: {{ formatAmount(spentCents) }}</div>
        <div v-if="status === 'over-budget'">
          Überschritten um: {{ formatAmount(Math.abs(remaining)) }}
        </div>
        <div v-else>Verbleibend: {{ formatAmount(remaining) }}</div>
      </div>
    </TooltipContent>
  </Tooltip>
</template>
