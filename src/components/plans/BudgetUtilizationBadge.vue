<script setup lang="ts">
import { computed } from 'vue'
import {
  formatAmount,
  formatPlanMonthLabel,
  formatWholeEuros,
  getMonthPacing,
  getMonthWeekSegments,
} from '@/lib/format'
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

/** True only while the plan month is the month we are living in */
const isCurrentMonth = computed(() => Boolean(pacing.value?.isCurrent))

/** Share of the month that has already passed (0 – 1) */
const elapsedRatio = computed(() =>
  pacing.value ? pacing.value.daysElapsed / pacing.value.totalDays : 0,
)

const expectedCents = computed(() =>
  Math.round(props.budgetedCents * elapsedRatio.value),
)

const paceDelta = computed(() => props.spentCents - expectedCents.value)

const paceTolerance = computed(() => props.budgetedCents * 0.01)

/** Pacing statements only make sense inside the running month with a budget */
const isPacingRelevant = computed(
  () => isCurrentMonth.value && props.budgetedCents > 0,
)

/** Remaining days including today */
const daysLeft = computed(() =>
  pacing.value ? pacing.value.totalDays - pacing.value.daysElapsed + 1 : 0,
)

const perDayLeft = computed(() =>
  remaining.value > 0 && daysLeft.value > 0
    ? remaining.value / daysLeft.value
    : 0,
)

/** Month-end projection if spending continues at the current rate */
const projectionCents = computed(() => {
  if (!pacing.value || pacing.value.daysElapsed <= 0) return 0
  return Math.round(
    (props.spentCents / pacing.value.daysElapsed) * pacing.value.totalDays,
  )
})

const showProjection = computed(
  () => isPacingRelevant.value && props.spentCents > 0,
)

const projectionDelta = computed(
  () => projectionCents.value - props.budgetedCents,
)

type TooltipStatus =
  | Extract<BudgetStatus, 'over-budget' | 'no-spending'>
  | 'ahead-of-pace'
  | 'on-track'

/**
 * Single source for pill, bar fill and footer dot. Refines the badge status
 * rather than re-deriving the thresholds, so both can never disagree.
 */
const tooltipStatus = computed<TooltipStatus>(() => {
  if (status.value === 'over-budget' || status.value === 'no-spending')
    return status.value
  if (isPacingRelevant.value && paceDelta.value > paceTolerance.value)
    return 'ahead-of-pace'
  return 'on-track'
})

/** Bar fill, footer dot and pill colours of one state, kept together */
const tooltipStyles: Record<TooltipStatus, { bar: string; pill: string }> = {
  'over-budget': {
    bar: 'bg-rose-400 dark:bg-rose-600',
    pill: 'bg-rose-400/20 text-rose-200 dark:bg-rose-700/15 dark:text-rose-800',
  },
  'no-spending': {
    bar: 'bg-background/35',
    pill: 'bg-background/15 text-background/90',
  },
  'ahead-of-pace': {
    bar: 'bg-amber-400 dark:bg-amber-600',
    pill: 'bg-amber-400/20 text-amber-200 dark:bg-amber-700/15 dark:text-amber-800',
  },
  'on-track': {
    bar: 'bg-lime-400 dark:bg-lime-600',
    pill: 'bg-lime-400/20 text-lime-200 dark:bg-lime-700/15 dark:text-lime-800',
  },
}

const tooltipStyle = computed(() => tooltipStyles[tooltipStatus.value])

const tooltipPillText = computed(() => {
  switch (tooltipStatus.value) {
    case 'over-budget':
      return `${formatAmount(Math.abs(remaining.value))} über Budget`
    case 'no-spending':
      return 'Noch keine Ausgaben'
    case 'ahead-of-pace':
      return `${formatAmount(paceDelta.value)} über Tempo`
    default:
      if (!isPacingRelevant.value) return 'Im Budget'
      return paceDelta.value < -paceTolerance.value
        ? `${formatAmount(Math.abs(paceDelta.value))} unter Tempo`
        : 'Im Tempo'
  }
})

const monthLabel = computed(() =>
  props.planDate ? formatPlanMonthLabel(props.planDate) : null,
)

const weekSegments = computed(() =>
  props.planDate ? getMonthWeekSegments(props.planDate) : [],
)

/** Week boundaries inside the month, as percentages of the bar width */
const weekTicks = computed(() =>
  weekSegments.value.slice(1).map((segment) => segment.startPercent),
)

/** Narrow segments drop their label so the axis stays readable */
const MIN_LABEL_WIDTH_PERCENT = 12

/** Wording next to the hero amount, flipped once the budget is exceeded */
const heroSuffix = computed(() =>
  remaining.value >= 0
    ? `verbleibend von ${formatAmount(props.budgetedCents)}`
    : `zu viel · Budget ${formatAmount(props.budgetedCents)}`,
)

/** Week labels that actually fit on the axis, pre-positioned and pre-styled */
const weekLabels = computed(() =>
  weekSegments.value
    .filter(
      (segment) =>
        segment.isCurrent || segment.widthPercent >= MIN_LABEL_WIDTH_PERCENT,
    )
    .map((segment) => ({
      key: segment.startDay,
      left: segment.startPercent + segment.widthPercent / 2,
      text: `KW ${segment.isoWeek}`,
      class: segment.isCurrent
        ? 'text-background font-semibold'
        : 'text-background/60',
    })),
)

/** Time statement plus optional month-end projection, as one sentence pair */
const footerText = computed(() => {
  if (!pacing.value) return ''
  const { daysElapsed, totalDays, percentElapsed } = pacing.value
  const elapsed = `Tag ${daysElapsed} von ${totalDays} · ${Math.round(percentElapsed)} % der Zeit vergangen.`
  if (!showProjection.value) return elapsed

  const deltaEuros = Math.round(projectionDelta.value / 100)
  const deltaText =
    deltaEuros === 0
      ? 'genau im Budget'
      : `${formatWholeEuros(Math.abs(projectionDelta.value))} ${deltaEuros > 0 ? 'über' : 'unter'} Budget`
  return `${elapsed} In diesem Tempo endet der Monat bei ${formatWholeEuros(projectionCents.value)} — ${deltaText}.`
})

const metrics = computed(() => {
  if (isCurrentMonth.value) {
    return [
      { label: 'Ausgegeben', value: formatAmount(props.spentCents) },
      { label: 'Soll bisher', value: formatAmount(expectedCents.value) },
      remaining.value > 0
        ? {
            label: 'Pro Tag noch',
            value: formatAmount(Math.round(perDayLeft.value)),
          }
        : { label: 'Tage übrig', value: String(daysLeft.value) },
    ]
  }
  return [
    { label: 'Budget', value: formatAmount(props.budgetedCents) },
    { label: 'Ausgegeben', value: formatAmount(props.spentCents) },
    { label: 'Verbleibend', value: formatAmount(remaining.value) },
  ]
})
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
    <TooltipContent class="w-[300px] p-3">
      <!-- Kopfzeile -->
      <div class="flex items-center justify-between gap-2">
        <span
          v-if="monthLabel"
          class="text-background/60 text-[10px] tracking-wider uppercase"
        >
          {{ monthLabel }}
        </span>
        <span
          :class="[
            'ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold',
            tooltipStyle.pill,
          ]"
        >
          {{ tooltipPillText }}
        </span>
      </div>

      <!-- Hero -->
      <div class="mt-1 flex items-baseline gap-1.5">
        <span class="text-xl font-semibold tabular-nums">
          {{ formatAmount(Math.abs(remaining)) }}
        </span>
        <span class="text-background/60 text-[11px]">{{ heroSuffix }}</span>
      </div>

      <!-- Zeitachse -->
      <div class="relative mt-2.5 h-2.5">
        <div
          class="bg-background/15 absolute inset-0 overflow-hidden rounded-full"
        >
          <div
            data-testid="budget-bar-fill"
            :class="['h-full', tooltipStyle.bar]"
            :style="{ width: progressPercent + '%' }"
          />
          <div
            v-for="tick in weekTicks"
            :key="tick"
            data-testid="week-tick"
            class="bg-foreground/60 absolute inset-y-0 w-px"
            :style="{ left: tick + '%' }"
          />
        </div>
        <div
          v-if="isCurrentMonth"
          data-testid="today-marker"
          class="bg-background absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full"
          :style="{ left: elapsedRatio * 100 + '%' }"
          aria-hidden="true"
        />
      </div>

      <!-- KW-Achse -->
      <div v-if="weekSegments.length" class="relative mt-1 h-3.5">
        <span
          v-for="label in weekLabels"
          :key="label.key"
          :class="[
            'absolute top-0 -translate-x-1/2 text-[9px] whitespace-nowrap',
            label.class,
          ]"
          :style="{ left: label.left + '%' }"
        >
          {{ label.text }}
        </span>
      </div>

      <!-- Kennzahlen -->
      <div class="bg-background/10 mt-2 grid grid-cols-3 gap-2 rounded-md p-2">
        <div v-for="metric in metrics" :key="metric.label">
          <div
            data-testid="metric-label"
            class="text-background/60 text-[9px] tracking-wide uppercase"
          >
            {{ metric.label }}
          </div>
          <div class="text-xs font-semibold tabular-nums">
            {{ metric.value }}
          </div>
        </div>
      </div>

      <!-- Fußzeile -->
      <div
        v-if="isCurrentMonth"
        class="border-background/15 text-background/70 mt-2 flex items-start gap-1.5 border-t pt-2 text-[11px]"
      >
        <span
          :class="['mt-1 size-1.5 shrink-0 rounded-full', tooltipStyle.bar]"
        />
        <span>{{ footerText }}</span>
      </div>
    </TooltipContent>
  </Tooltip>
</template>
