<script setup lang="ts">
import { computed } from 'vue'
import type { InstallmentPlanWithStats } from '@/lib/installments'
import { formatAmount } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { TableCell, TableRow } from '@/components/ui/table'
import { BadgeCheck, Edit2, Trash2 } from 'lucide-vue-next'
import { formatMonthNumeric } from './installment-format'

const props = defineProps<{
  installment: InstallmentPlanWithStats
}>()

const emit = defineEmits<{
  edit: []
  complete: []
  delete: []
}>()

const isCompleted = computed(() => props.installment.completedAt !== null)

/** Share of the installments already paid, clamped to 0–100. */
const progressPercent = computed(() => {
  const { paidCount, totalInstallments } = props.installment
  if (totalInstallments <= 0) return 0
  const percent = (paidCount / totalInstallments) * 100
  return Math.min(100, Math.max(0, Math.round(percent)))
})

const endMonth = computed(() =>
  props.installment.projectedEndMonth
    ? formatMonthNumeric(props.installment.projectedEndMonth)
    : '—',
)
</script>

<template>
  <TableRow :class="{ 'opacity-60': isCompleted }">
    <TableCell>
      <div class="flex items-center gap-2">
        {{ installment.name }}
        <Badge v-if="isCompleted" variant="secondary" class="gap-1">
          <BadgeCheck class="size-3" />
          Abgelöst
        </Badge>
      </div>
    </TableCell>

    <TableCell>
      <div v-if="installment.categoryName" class="flex items-center gap-2">
        <span
          v-if="installment.categoryColor"
          class="size-3 shrink-0 rounded-full"
          :style="{ backgroundColor: installment.categoryColor }"
        />
        {{ installment.categoryName }}
      </div>
      <span v-else class="text-muted-foreground">—</span>
    </TableCell>

    <TableCell>
      <div class="space-y-1.5">
        <span class="text-sm">
          {{ installment.paidCount }} von
          {{ installment.totalInstallments }} Raten bezahlt
        </span>
        <Progress :model-value="progressPercent" />
      </div>
    </TableCell>

    <TableCell class="text-rose-600 dark:text-rose-400">
      {{ formatAmount(installment.amount) }}
    </TableCell>

    <TableCell>
      {{ formatAmount(installment.remainingSum) }}
    </TableCell>

    <TableCell>{{ endMonth }}</TableCell>

    <TableCell>
      <div class="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Bearbeiten"
          @click="emit('edit')"
        >
          <Edit2 class="size-4" />
        </Button>
        <Button
          v-if="!isCompleted"
          variant="ghost"
          size="icon-sm"
          title="Ablösen"
          @click="emit('complete')"
        >
          <BadgeCheck class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Löschen"
          @click="emit('delete')"
        >
          <Trash2 class="text-destructive size-4" />
        </Button>
      </div>
    </TableCell>
  </TableRow>
</template>
