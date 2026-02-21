<script setup lang="ts">
import { computed } from 'vue'
import { formatAmount } from '@/lib/format'
import type { KassensturzSummary } from '@/lib/kassensturz'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingDown,
  TrendingUp,
  Wallet,
  Scale,
} from 'lucide-vue-next'

const props = defineProps<{
  summary: KassensturzSummary
}>()

const incomeDiff = computed(
  () => props.summary.actualIncome - props.summary.plannedIncome,
)
const expenseDiff = computed(
  () => props.summary.actualExpense - props.summary.plannedExpense,
)
const netDiff = computed(
  () => props.summary.actualNet - props.summary.plannedNet,
)
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <!-- Geplante Einnahmen -->
    <div class="bg-card rounded-lg border p-4">
      <div class="flex items-center gap-3">
        <div class="rounded-full bg-lime-100 p-2 dark:bg-lime-900">
          <ArrowUpCircle class="size-5 text-lime-600 dark:text-lime-400" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-muted-foreground text-xs">Geplante Einnahmen</p>
          <p class="text-lg font-semibold text-lime-600 dark:text-lime-400">
            {{ formatAmount(summary.plannedIncome) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Tatsächliche Einnahmen -->
    <div class="bg-card rounded-lg border p-4">
      <div class="flex items-center gap-3">
        <div class="rounded-full bg-lime-100 p-2 dark:bg-lime-900">
          <TrendingUp class="size-5 text-lime-600 dark:text-lime-400" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-muted-foreground text-xs">Tatsächliche Einnahmen</p>
          <p class="text-lg font-semibold text-lime-600 dark:text-lime-400">
            {{ formatAmount(summary.actualIncome) }}
          </p>
          <p
            v-if="incomeDiff !== 0"
            class="text-xs font-medium"
            :class="
              incomeDiff >= 0
                ? 'text-lime-600 dark:text-lime-400'
                : 'text-rose-600 dark:text-rose-400'
            "
          >
            {{ incomeDiff >= 0 ? '+' : '' }}{{ formatAmount(incomeDiff) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Geplanter Saldo -->
    <div class="bg-card rounded-lg border p-4">
      <div class="flex items-center gap-3">
        <div
          class="rounded-full p-2"
          :class="
            summary.plannedNet >= 0
              ? 'bg-lime-100 dark:bg-lime-900'
              : 'bg-rose-100 dark:bg-rose-900'
          "
        >
          <Wallet
            class="size-5"
            :class="
              summary.plannedNet >= 0
                ? 'text-lime-600 dark:text-lime-400'
                : 'text-rose-600 dark:text-rose-400'
            "
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-muted-foreground text-xs">Geplanter Saldo</p>
          <p
            class="text-lg font-semibold"
            :class="
              summary.plannedNet >= 0
                ? 'text-lime-600 dark:text-lime-400'
                : 'text-rose-600 dark:text-rose-400'
            "
          >
            {{ summary.plannedNet >= 0 ? '+' : ''
            }}{{ formatAmount(summary.plannedNet) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Geplante Ausgaben -->
    <div class="bg-card rounded-lg border p-4">
      <div class="flex items-center gap-3">
        <div class="rounded-full bg-rose-100 p-2 dark:bg-rose-900">
          <ArrowDownCircle class="size-5 text-rose-600 dark:text-rose-400" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-muted-foreground text-xs">Geplante Ausgaben</p>
          <p class="text-lg font-semibold text-rose-600 dark:text-rose-400">
            {{ formatAmount(summary.plannedExpense) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Tatsächliche Ausgaben -->
    <div class="bg-card rounded-lg border p-4">
      <div class="flex items-center gap-3">
        <div class="rounded-full bg-rose-100 p-2 dark:bg-rose-900">
          <TrendingDown class="size-5 text-rose-600 dark:text-rose-400" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-muted-foreground text-xs">Tatsächliche Ausgaben</p>
          <p class="text-lg font-semibold text-rose-600 dark:text-rose-400">
            {{ formatAmount(summary.actualExpense) }}
          </p>
          <p
            v-if="expenseDiff !== 0"
            class="text-xs font-medium"
            :class="
              expenseDiff <= 0
                ? 'text-lime-600 dark:text-lime-400'
                : 'text-rose-600 dark:text-rose-400'
            "
          >
            {{ expenseDiff > 0 ? '+' : '' }}{{ formatAmount(expenseDiff) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Tatsächlicher Saldo -->
    <div class="bg-card rounded-lg border p-4">
      <div class="flex items-center gap-3">
        <div
          class="rounded-full p-2"
          :class="
            summary.actualNet >= 0
              ? 'bg-lime-100 dark:bg-lime-900'
              : 'bg-rose-100 dark:bg-rose-900'
          "
        >
          <Scale
            class="size-5"
            :class="
              summary.actualNet >= 0
                ? 'text-lime-600 dark:text-lime-400'
                : 'text-rose-600 dark:text-rose-400'
            "
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-muted-foreground text-xs">Tatsächlicher Saldo</p>
          <p
            class="text-lg font-semibold"
            :class="
              summary.actualNet >= 0
                ? 'text-lime-600 dark:text-lime-400'
                : 'text-rose-600 dark:text-rose-400'
            "
          >
            {{ summary.actualNet >= 0 ? '+' : ''
            }}{{ formatAmount(summary.actualNet) }}
          </p>
          <p
            v-if="netDiff !== 0"
            class="text-xs font-medium"
            :class="
              netDiff >= 0
                ? 'text-lime-600 dark:text-lime-400'
                : 'text-rose-600 dark:text-rose-400'
            "
          >
            {{ netDiff >= 0 ? '+' : '' }}{{ formatAmount(netDiff) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
