<script setup lang="ts">
import { computed } from 'vue'
import { formatAmount } from '@/lib/format'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ListTodo,
  Wallet,
} from 'lucide-vue-next'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const props = defineProps<{
  count: number
  incomeTotal: number
  expenseTotal: number
}>()

const net = computed(() => props.incomeTotal - props.expenseTotal)
</script>

<template>
  <Card>
    <CardHeader class="pb-2">
      <CardDescription>Noch zu erledigen</CardDescription>
      <CardTitle class="text-2xl">Offene Transaktionen</CardTitle>
    </CardHeader>
    <CardContent class="space-y-3">
      <div class="flex items-center gap-2">
        <ListTodo class="text-muted-foreground size-4" />
        <span class="text-muted-foreground text-sm">Anzahl</span>
        <span class="ml-auto text-lg font-semibold">{{ count }}</span>
      </div>

      <div v-if="incomeTotal > 0" class="flex items-center gap-2">
        <ArrowUpCircle class="size-4 text-lime-600 dark:text-lime-400" />
        <span class="text-muted-foreground text-sm">Erwartete Einnahmen</span>
        <span class="ml-auto font-medium text-lime-600 dark:text-lime-400">
          +{{ formatAmount(incomeTotal) }}
        </span>
      </div>

      <div v-if="expenseTotal > 0" class="flex items-center gap-2">
        <ArrowDownCircle class="size-4 text-rose-600 dark:text-rose-400" />
        <span class="text-muted-foreground text-sm">Ausstehende Ausgaben</span>
        <span class="ml-auto font-medium text-rose-600 dark:text-rose-400">
          -{{ formatAmount(expenseTotal) }}
        </span>
      </div>

      <div
        v-if="incomeTotal > 0 || expenseTotal > 0"
        class="flex items-center gap-2 border-t pt-3"
      >
        <Wallet
          class="size-4"
          :class="
            net >= 0
              ? 'text-lime-600 dark:text-lime-400'
              : 'text-rose-600 dark:text-rose-400'
          "
        />
        <span class="text-muted-foreground text-sm">Netto</span>
        <span
          class="ml-auto text-lg font-semibold"
          :class="
            net >= 0
              ? 'text-lime-600 dark:text-lime-400'
              : 'text-rose-600 dark:text-rose-400'
          "
        >
          {{ net >= 0 ? '+' : '' }}{{ formatAmount(net) }}
        </span>
      </div>

      <div
        v-if="count === 0"
        class="text-muted-foreground border-t pt-3 text-sm"
      >
        Keine offenen Transaktionen
      </div>
    </CardContent>
  </Card>
</template>
