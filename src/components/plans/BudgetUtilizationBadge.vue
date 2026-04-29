<script setup lang="ts">
import { computed } from 'vue'
import { formatAmount, getMonthPacing } from '@/lib/format'
import { Wallet, AlertTriangle, CircleCheck } from 'lucide-vue-next'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const props = defineProps<{
  budgetedCents: number
  spentCents: number
  planDate?: string | null
}>()

type BudgetStatus = 'no-spending' | 'under-budget' | 'at-budget' | 'over-budget'

const status = computed<BudgetStatus>(() => {
  if (props.spentCents <= 0) return 'no-spending'
  if (props.spentCents > props.budgetedCents) return 'over-budget'
  if (props.spentCents === props.budgetedCents) return 'at-budget'
  return 'under-budget'
})

const remaining = computed(() => props.budgetedCents - props.spentCents)

const progressPercent = computed(() => {
  if (props.budgetedCents <= 0) return 0
  return Math.min(100, (props.spentCents / props.budgetedCents) * 100)
})

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
    'border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-800 dark:bg-lime-950 dark:text-lime-300',
  'over-budget':
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300',
} as const

const barColorMap = {
  'no-spending': 'bg-muted-foreground/30',
  'under-budget': 'bg-lime-500 dark:bg-lime-400',
  'at-budget': 'bg-lime-500 dark:bg-lime-400',
  'over-budget': 'bg-rose-500 dark:bg-rose-400',
} as const

const pacing = computed(() =>
  props.planDate ? getMonthPacing(props.planDate) : null,
)

const expectedCents = computed(() => {
  if (!pacing.value) return 0
  return Math.round(
    (props.budgetedCents * pacing.value.daysElapsed) / pacing.value.totalDays,
  )
})

const paceDelta = computed(() => props.spentCents - expectedCents.value)

const showPacing = computed(
  () =>
    pacing.value?.isCurrent && props.spentCents > 0 && props.budgetedCents > 0,
)

const paceTolerance = computed(() => props.budgetedCents * 0.01)
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <span
        :class="[
          'inline-flex flex-col rounded-md border px-2 pt-0.5 pb-1 text-xs font-medium',
          colorMap[status],
        ]"
      >
        <span class="inline-flex items-center gap-1.5">
          <component :is="iconMap[status]" class="size-3" />
          {{ formatAmount(spentCents) }} / {{ formatAmount(budgetedCents) }}
        </span>
        <span
          class="mt-0.5 block h-1 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
        >
          <span
            :class="['block h-full transition-all', barColorMap[status]]"
            :style="{ width: progressPercent + '%' }"
          />
        </span>
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
        <template v-if="showPacing && pacing">
          <div class="border-border/50 my-1 border-t" />
          <div>
            Zeitraum: Tag {{ pacing.daysElapsed }} von
            {{ pacing.totalDays }} ({{ Math.round(pacing.percentElapsed) }} %
            vergangen)
          </div>
          <div>Erwartet bisher: ~{{ formatAmount(expectedCents) }}</div>
          <div class="mt-0.5 flex items-center gap-1">
            <template v-if="Math.abs(paceDelta) < paceTolerance">
              <CircleCheck class="size-3 text-lime-600 dark:text-lime-400" />
              <span>Im erwarteten Tempo</span>
            </template>
            <template v-else-if="paceDelta > 0">
              <AlertTriangle
                class="size-3 text-amber-600 dark:text-amber-400"
              />
              <span
                >{{ formatAmount(paceDelta) }} über dem erwarteten Tempo</span
              >
            </template>
            <template v-else>
              <CircleCheck class="size-3 text-lime-600 dark:text-lime-400" />
              <span
                >{{ formatAmount(Math.abs(paceDelta)) }} unter dem erwarteten
                Tempo</span
              >
            </template>
          </div>
        </template>
      </div>
    </TooltipContent>
  </Tooltip>
</template>
