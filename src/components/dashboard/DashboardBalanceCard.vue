<script setup lang="ts">
import { computed } from 'vue'
import { getPlanDisplayName } from '@/lib/format'
import { ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-vue-next'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const props = defineProps<{
  planName: string | null
  planDate: string
  income: number
  expense: number
  net: number
}>()

const displayName = computed(() =>
  getPlanDisplayName(props.planName, props.planDate),
)

function formatAmount(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}
</script>

<template>
  <Card>
    <CardHeader class="pb-2">
      <CardDescription>{{ displayName }}</CardDescription>
      <CardTitle class="text-2xl">Aktueller Saldo</CardTitle>
    </CardHeader>
    <CardContent class="space-y-3">
      <div class="flex items-center gap-2">
        <ArrowUpCircle class="size-4 text-green-600 dark:text-green-400" />
        <span class="text-muted-foreground text-sm">Einnahmen</span>
        <span class="ml-auto font-medium text-green-600 dark:text-green-400">
          {{ formatAmount(income) }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <ArrowDownCircle class="size-4 text-red-600 dark:text-red-400" />
        <span class="text-muted-foreground text-sm">Ausgaben</span>
        <span class="ml-auto font-medium text-red-600 dark:text-red-400">
          {{ formatAmount(expense) }}
        </span>
      </div>
      <div class="border-t pt-3">
        <div class="flex items-center gap-2">
          <Wallet
            class="size-4"
            :class="
              net >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            "
          />
          <span class="text-muted-foreground text-sm">Saldo</span>
          <span
            class="ml-auto text-lg font-semibold"
            :class="
              net >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            "
          >
            {{ net >= 0 ? '+' : '' }}{{ formatAmount(net) }}
          </span>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
