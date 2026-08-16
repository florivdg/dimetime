<script setup lang="ts">
import { ref } from 'vue'
import type { Category } from '@/lib/categories'
import type {
  InstallmentOverview,
  InstallmentPlanWithStats,
} from '@/lib/installments'
import { formatAmount } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CalendarClock, Loader2, Plus, Wallet } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import InstallmentFormDialog from './InstallmentFormDialog.vue'
import InstallmentTable from './InstallmentTable.vue'
import InstallmentTimelineChart from './InstallmentTimelineChart.vue'

const props = defineProps<{
  initialOverview: InstallmentOverview
  categories: Category[]
}>()

const overview = ref<InstallmentOverview>(props.initialOverview)
const isLoading = ref(false)

const formDialogOpen = ref(false)
const selectedInstallment = ref<InstallmentPlanWithStats | null>(null)

async function loadOverview() {
  isLoading.value = true
  try {
    const response = await fetch('/api/installments/overview')
    if (!response.ok) throw new Error('Fehler beim Laden')
    overview.value = (await response.json()) as InstallmentOverview
  } catch {
    toast.error('Ratenzahlungen konnten nicht geladen werden.')
  } finally {
    isLoading.value = false
  }
}

function openCreateDialog() {
  selectedInstallment.value = null
  formDialogOpen.value = true
}

function openEditDialog(installment: InstallmentPlanWithStats) {
  selectedInstallment.value = installment
  formDialogOpen.value = true
}

function handleSaved(name: string, isNew: boolean) {
  toast.success(
    isNew
      ? `Ratenzahlung "${name}" wurde angelegt`
      : `Ratenzahlung "${name}" wurde aktualisiert`,
  )
  loadOverview()
}

function handleCompleted(name: string) {
  toast.success(`Ratenzahlung "${name}" wurde abgelöst`)
  loadOverview()
}

function handleDeleted(name: string) {
  toast.success(`Ratenzahlung "${name}" wurde gelöscht`)
  loadOverview()
}

function handleError(message: string) {
  toast.error(message)
}
</script>

<template>
  <div class="flex flex-1 flex-col gap-4">
    <div class="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader class="pb-2">
          <CardDescription>Summe der Raten in diesem Monat</CardDescription>
          <CardTitle class="text-2xl">Aktuelle Monatsbelastung</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="flex items-center gap-3">
            <div class="rounded-full bg-rose-100 p-2 dark:bg-rose-900">
              <CalendarClock class="size-5 text-rose-600 dark:text-rose-400" />
            </div>
            <span class="text-2xl font-semibold">
              {{ formatAmount(overview.aggregates.currentMonthlyLoad) }}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="pb-2">
          <CardDescription>Offene Summe aller Ratenzahlungen</CardDescription>
          <CardTitle class="text-2xl">Gesamt-Restschuld</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="flex items-center gap-3">
            <div class="rounded-full bg-amber-100 p-2 dark:bg-amber-900">
              <Wallet class="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <span class="text-2xl font-semibold">
              {{ formatAmount(overview.aggregates.totalRemainingSum) }}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>

    <InstallmentTimelineChart :timeline="overview.timeline" />

    <div class="flex items-center justify-end">
      <Button @click="openCreateDialog">
        <Plus class="size-4" />
        Neue Ratenzahlung
      </Button>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Loader2 class="text-muted-foreground size-6 animate-spin" />
    </div>

    <InstallmentTable
      v-else
      :installments="overview.installments"
      @edit="openEditDialog"
      @completed="handleCompleted"
      @deleted="handleDeleted"
      @error="handleError"
    />

    <InstallmentFormDialog
      v-model:open="formDialogOpen"
      :installment="selectedInstallment"
      :categories="categories"
      @saved="handleSaved"
      @error="handleError"
    />
  </div>
</template>
