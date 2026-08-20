<script setup lang="ts">
import type { DashboardInstallment } from '@/lib/dashboard'
import { formatAmount } from '@/lib/format'
import { ArrowUpRight, CalendarClock, Wallet } from 'lucide-vue-next'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ratePercent } from '@/components/installments/installment-format'

defineProps<{
  monthlyLoad: number
  totalRemainingSum: number
  installments: DashboardInstallment[]
}>()
</script>

<template>
  <Card>
    <CardHeader class="pb-2">
      <CardDescription>Laufende Ratenzahlungen</CardDescription>
      <CardTitle class="text-2xl">Ratenzahlungen</CardTitle>
      <CardAction>
        <a
          href="/installments"
          class="text-muted-foreground hover:text-foreground"
          aria-label="Alle Ratenzahlungen anzeigen"
        >
          <ArrowUpRight class="size-4" />
        </a>
      </CardAction>
    </CardHeader>
    <CardContent class="space-y-3">
      <div class="flex items-center gap-2">
        <CalendarClock class="size-4 text-rose-600 dark:text-rose-400" />
        <span class="text-muted-foreground text-sm">Pro Monat</span>
        <span
          class="ml-auto text-lg font-semibold text-rose-600 dark:text-rose-400"
        >
          {{ formatAmount(monthlyLoad) }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <Wallet class="text-muted-foreground size-4" />
        <span class="text-muted-foreground text-sm">Restschuld</span>
        <span class="ml-auto font-medium">
          {{ formatAmount(totalRemainingSum) }}
        </span>
      </div>

      <div v-if="installments.length > 0" class="space-y-3 border-t pt-3">
        <div
          v-for="installment in installments"
          :key="installment.id"
          class="space-y-1.5"
        >
          <div class="flex items-center gap-2">
            <span class="flex-1 truncate text-sm">{{ installment.name }}</span>
            <span class="font-medium">{{
              formatAmount(installment.amount)
            }}</span>
          </div>
          <Progress
            :model-value="
              ratePercent(installment.paidCount, installment.totalInstallments)
            "
          />
          <span class="text-muted-foreground text-xs">
            Rate {{ installment.paidCount }} von
            {{ installment.totalInstallments }}
          </span>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
