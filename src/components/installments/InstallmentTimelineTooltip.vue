<script setup lang="ts">
import { computed } from 'vue'
import type { ChartConfig } from '@/components/ui/chart'
import { formatAmount } from '@/lib/format'
import { formatMonthShort } from './installment-format'

/** Shape of a data point of {@link InstallmentTimelineChart}. */
interface TimelineTooltipPayload {
  month?: Date
  total?: number
  amounts?: Record<string, number>
}

const props = withDefaults(
  defineProps<{
    payload?: TimelineTooltipPayload
    config?: ChartConfig
    x?: number | Date
  }>(),
  {
    payload: () => ({}),
    config: () => ({}),
  },
)

const monthLabel = computed(() => {
  // The crosshair hands the x value in separately; the data point wins
  const month = props.payload.month ?? props.x
  return month === undefined ? '' : formatMonthShort(new Date(month))
})

const rows = computed(() =>
  Object.entries(props.payload.amounts ?? {})
    .filter(([, amount]) => amount > 0)
    .map(([id, amount]) => ({
      id,
      amount,
      label: String(props.config[id]?.label ?? id),
      color: props.config[id]?.color ?? 'var(--muted-foreground)',
    })),
)
</script>

<template>
  <div
    class="border-border/50 bg-background grid min-w-40 gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl"
  >
    <div v-if="monthLabel" class="font-medium">{{ monthLabel }}</div>
    <div class="grid gap-1.5">
      <div
        v-for="row in rows"
        :key="row.id"
        class="flex items-center gap-2 leading-none"
      >
        <span
          class="size-2.5 shrink-0 rounded-xs"
          :style="{ backgroundColor: row.color }"
        />
        <span class="text-muted-foreground">{{ row.label }}</span>
        <span class="text-foreground ml-auto font-medium tabular-nums">
          {{ formatAmount(row.amount) }}
        </span>
      </div>
    </div>
    <div
      v-if="rows.length > 1"
      class="border-border/50 flex items-center gap-2 border-t pt-1.5 leading-none"
    >
      <span class="text-muted-foreground">Gesamt</span>
      <span class="text-foreground ml-auto font-medium tabular-nums">
        {{ formatAmount(payload.total ?? 0) }}
      </span>
    </div>
  </div>
</template>
