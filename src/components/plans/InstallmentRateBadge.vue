<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { HandCoins } from 'lucide-vue-next'

defineProps<{
  /** Name of the installment plan the transaction belongs to. */
  installmentName: string | null
  /** Position of this rate within the installment plan. */
  ratePosition: number
  /** Total number of installments of the plan. */
  rateTotal: number | null
}>()
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Badge variant="secondary" class="gap-1">
        <HandCoins class="size-3" />
        Rate {{ ratePosition }}/{{ rateTotal }}
      </Badge>
    </TooltipTrigger>
    <TooltipContent>
      <p>Ratenzahlung: {{ installmentName }}</p>
    </TooltipContent>
  </Tooltip>
</template>
