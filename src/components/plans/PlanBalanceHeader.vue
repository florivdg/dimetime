<script setup lang="ts">
import { computed } from 'vue'
import { formatAmount, formatDate, getPlanDisplayName } from '@/lib/format'
import { ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-vue-next'

const props = defineProps<{
  planName: string | null
  planDate: string
  income: number
  expense: number
}>()

const net = computed(() => props.income - props.expense)

const displayName = computed(() =>
  getPlanDisplayName(props.planName, props.planDate),
)
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-2xl font-bold">{{ displayName }}</h1>
      <p class="text-muted-foreground text-sm">
        {{ formatDate(planDate, 'long') }}
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <!-- Income -->
      <div class="bg-card rounded-lg border p-4">
        <div class="flex items-center gap-3">
          <div class="rounded-full bg-green-100 p-2 dark:bg-green-900">
            <ArrowUpCircle class="size-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p class="text-muted-foreground text-sm">Einnahmen</p>
            <p class="text-lg font-semibold text-green-600 dark:text-green-400">
              {{ formatAmount(income) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Expenses -->
      <div class="bg-card rounded-lg border p-4">
        <div class="flex items-center gap-3">
          <div class="rounded-full bg-red-100 p-2 dark:bg-red-900">
            <ArrowDownCircle class="size-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p class="text-muted-foreground text-sm">Ausgaben</p>
            <p class="text-lg font-semibold text-red-600 dark:text-red-400">
              {{ formatAmount(expense) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Balance -->
      <div class="bg-card rounded-lg border p-4">
        <div class="flex items-center gap-3">
          <div
            class="rounded-full p-2"
            :class="
              net >= 0
                ? 'bg-green-100 dark:bg-green-900'
                : 'bg-red-100 dark:bg-red-900'
            "
          >
            <Wallet
              class="size-5"
              :class="
                net >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              "
            />
          </div>
          <div>
            <p class="text-muted-foreground text-sm">Saldo</p>
            <p
              class="text-lg font-semibold"
              :class="
                net >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              "
            >
              {{ net >= 0 ? '+' : '' }}{{ formatAmount(net) }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
