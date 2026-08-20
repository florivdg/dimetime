<script setup lang="ts">
import { computed } from 'vue'
import type { ChartConfig } from '@/components/ui/chart'
import type { InstallmentTimelineMonth } from '@/lib/installments'
import { VisAxis, VisStackedBar, VisXYContainer } from '@unovis/vue'
import { formatAmount } from '@/lib/format'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartCrosshair,
  ChartTooltip,
  componentToString,
} from '@/components/ui/chart'
import InstallmentTimelineTooltip from './InstallmentTimelineTooltip.vue'
import { formatMonthShort, monthToDate } from './installment-format'

/** One stacked bar: the projected load of a single month. */
interface TimelinePoint {
  month: Date
  total: number
  amounts: Record<string, number>
}

interface TimelineSeries {
  id: string
  name: string
}

const props = defineProps<{
  timeline: InstallmentTimelineMonth[]
}>()

/** Chart palette, cycled when more installments than colours are running. */
const PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const

// Installments in order of their first appearance in the timeline
const series = computed<TimelineSeries[]>(() => {
  const found = new Map<string, TimelineSeries>()
  for (const month of props.timeline) {
    for (const entry of month.entries) {
      if (found.has(entry.installmentId)) continue
      found.set(entry.installmentId, {
        id: entry.installmentId,
        name: entry.name,
      })
    }
  }
  return [...found.values()]
})

const chartConfig = computed<ChartConfig>(() =>
  Object.fromEntries(
    series.value.map((entry, index) => [
      entry.id,
      { label: entry.name, color: PALETTE[index % PALETTE.length] },
    ]),
  ),
)

const chartData = computed<TimelinePoint[]>(() =>
  props.timeline.map((month) => ({
    month: monthToDate(month.month),
    total: month.total,
    amounts: Object.fromEntries(
      month.entries.map((entry) => [entry.installmentId, entry.amount]),
    ),
  })),
)

const yAccessors = computed(() =>
  series.value.map((entry) => (d: TimelinePoint) => d.amounts[entry.id] ?? 0),
)

const colors = computed(() =>
  series.value.map((_, index) => PALETTE[index % PALETTE.length]),
)
</script>

<template>
  <Card>
    <CardHeader class="pb-2">
      <CardDescription>Voraussichtliche Belastung pro Monat</CardDescription>
      <CardTitle class="text-2xl">Verlauf</CardTitle>
    </CardHeader>
    <CardContent>
      <div
        v-if="chartData.length === 0"
        class="flex h-[300px] items-center justify-center"
      >
        <span class="text-muted-foreground">
          Keine laufenden Ratenzahlungen vorhanden.
        </span>
      </div>
      <ChartContainer v-else :config="chartConfig" class="h-[300px] w-full">
        <VisXYContainer :data="chartData">
          <VisStackedBar
            :x="(d: TimelinePoint) => d.month"
            :y="yAccessors"
            :color="colors"
            :rounded-corners="4"
            bar-padding="0.15"
          />
          <VisAxis
            type="x"
            :x="(d: TimelinePoint) => d.month"
            :tick-line="false"
            :domain-line="false"
            :grid-line="false"
            :num-ticks="chartData.length"
            :tick-format="(d: number) => formatMonthShort(new Date(d))"
            :tick-values="chartData.map((d) => d.month)"
          />
          <VisAxis
            type="y"
            :num-ticks="4"
            :tick-line="false"
            :domain-line="false"
            :tick-format="(d: number) => formatAmount(d)"
          />
          <ChartTooltip />
          <ChartCrosshair
            :template="
              componentToString(chartConfig, InstallmentTimelineTooltip, {})
            "
            color="#0000"
          />
        </VisXYContainer>
      </ChartContainer>
    </CardContent>
  </Card>
</template>
