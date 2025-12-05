<script setup lang="ts">
import type { DashboardStats } from '@/lib/dashboard'
import DashboardBalanceCard from './DashboardBalanceCard.vue'
import DashboardPendingCard from './DashboardPendingCard.vue'
import DashboardCategoriesCard from './DashboardCategoriesCard.vue'
import DashboardMonthlyChart from './DashboardMonthlyChart.vue'

defineProps<{
  stats: DashboardStats
}>()
</script>

<template>
  <div class="flex flex-1 flex-col gap-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold tracking-tight">Dashboard</h1>
    </div>

    <!-- No plan state -->
    <div
      v-if="!stats.currentPlan"
      class="bg-muted/50 flex flex-1 items-center justify-center rounded-xl p-6"
    >
      <div class="text-center">
        <p class="text-muted-foreground text-lg">Kein aktiver Plan vorhanden</p>
        <p class="text-muted-foreground mt-1 text-sm">
          Erstelle einen neuen Plan, um loszulegen.
        </p>
      </div>
    </div>

    <!-- Dashboard with data -->
    <template v-else>
      <!-- Three stat cards -->
      <div class="grid gap-4 md:grid-cols-3">
        <DashboardBalanceCard
          :plan-name="stats.currentPlan.name"
          :plan-date="stats.currentPlan.date"
          :income="stats.currentPlan.income"
          :expense="stats.currentPlan.expense"
          :net="stats.currentPlan.net"
        />
        <DashboardPendingCard
          :count="stats.pendingTransactions.count"
          :income-total="stats.pendingTransactions.incomeTotal"
          :expense-total="stats.pendingTransactions.expenseTotal"
        />
        <DashboardCategoriesCard :categories="stats.topCategories" />
      </div>

      <!-- Full-width chart -->
      <DashboardMonthlyChart />
    </template>
  </div>
</template>
