<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import type { ChartConfig } from '@/components/ui/chart'
import { VisAxis, VisGroupedBar, VisXYContainer } from '@unovis/vue'
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
  ChartTooltipContent,
  componentToString,
} from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ChartDataPoint {
  month: Date
  income: number
  expense: number
}

type ChartRange = '6m' | '12m' | 'year'

const selectedRange = ref<ChartRange>('6m')
const chartData = ref<ChartDataPoint[]>([])
const isLoading = ref(true)

const chartConfig = {
  income: {
    label: 'Einnahmen',
    color: 'oklch(0.6 0.17 145)',
  },
  expense: {
    label: 'Ausgaben',
    color: 'oklch(0.65 0.2 25)',
  },
} satisfies ChartConfig

const rangeLabels: Record<ChartRange, string> = {
  '6m': 'Letzte 6 Monate',
  '12m': 'Letzte 12 Monate',
  year: 'Aktuelles Jahr',
}

async function loadChartData() {
  isLoading.value = true
  try {
    const response = await fetch(
      `/api/dashboard/chart?range=${selectedRange.value}`,
    )
    const result = await response.json()
    // Convert month strings to Date objects and cents to EUR
    chartData.value = result.data.map(
      (d: { month: string; income: number; expense: number }) => ({
        month: new Date(d.month),
        income: d.income / 100,
        expense: d.expense / 100,
      }),
    )
  } catch (error) {
    console.error('Failed to load chart data:', error)
    chartData.value = []
  } finally {
    isLoading.value = false
  }
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('de-DE', { month: 'short' })
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

watch(selectedRange, loadChartData)
onMounted(loadChartData)
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-center justify-between pb-2">
      <div>
        <CardDescription>Einnahmen und Ausgaben</CardDescription>
        <CardTitle class="text-2xl">Monatsübersicht</CardTitle>
      </div>
      <Select v-model="selectedRange">
        <SelectTrigger class="w-[180px]">
          <SelectValue :placeholder="rangeLabels[selectedRange]" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="6m">{{ rangeLabels['6m'] }}</SelectItem>
          <SelectItem value="12m">{{ rangeLabels['12m'] }}</SelectItem>
          <SelectItem value="year">{{ rangeLabels.year }}</SelectItem>
        </SelectContent>
      </Select>
    </CardHeader>
    <CardContent>
      <div v-if="isLoading" class="flex h-[300px] items-center justify-center">
        <span class="text-muted-foreground">Laden...</span>
      </div>
      <div
        v-else-if="chartData.length === 0"
        class="flex h-[300px] items-center justify-center"
      >
        <span class="text-muted-foreground">Keine Daten vorhanden</span>
      </div>
      <ChartContainer v-else :config="chartConfig" class="h-[300px] w-full">
        <VisXYContainer :data="chartData">
          <VisGroupedBar
            :x="(d: ChartDataPoint) => d.month"
            :y="[
              (d: ChartDataPoint) => d.income,
              (d: ChartDataPoint) => d.expense,
            ]"
            :color="[chartConfig.income.color, chartConfig.expense.color]"
            :rounded-corners="4"
            bar-padding="0.15"
            group-padding="0"
          />
          <VisAxis
            type="x"
            :x="(d: ChartDataPoint) => d.month"
            :tick-line="false"
            :domain-line="false"
            :grid-line="false"
            :num-ticks="chartData.length"
            :tick-format="(d: number) => formatMonth(new Date(d))"
            :tick-values="chartData.map((d) => d.month)"
          />
          <VisAxis
            type="y"
            :num-ticks="4"
            :tick-line="false"
            :domain-line="false"
            :tick-format="(d: number) => formatEur(d)"
          />
          <ChartTooltip />
          <ChartCrosshair
            :template="
              componentToString(chartConfig, ChartTooltipContent, {
                indicator: 'dashed',
                hideLabel: true,
              })
            "
            color="#0000"
          />
        </VisXYContainer>
      </ChartContainer>
    </CardContent>
  </Card>
</template>
