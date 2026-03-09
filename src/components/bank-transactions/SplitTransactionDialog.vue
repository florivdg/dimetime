<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { BankTransactionRow } from '@/lib/bank-transactions'
import { formatAmount } from '@/lib/format'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  transaction: BankTransactionRow | null
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  split: [splits: { amountCents: number; label?: string }[]]
}>()

interface SplitEntry {
  amountEuros: string
  label: string
}

const entries = ref<SplitEntry[]>([])
const currentAmount = ref('')
const currentLabel = ref('')

const isNegative = computed(() => (props.transaction?.amountCents ?? 0) < 0)
const totalAbsCents = computed(() =>
  Math.abs(props.transaction?.amountCents ?? 0),
)

const enteredAbsCents = computed(() =>
  entries.value.reduce((sum, e) => sum + eurosToCents(e.amountEuros), 0),
)

const remainingAbsCents = computed(
  () => totalAbsCents.value - enteredAbsCents.value,
)

const currentCents = computed(() => eurosToCents(currentAmount.value))

const canAddSplit = computed(() => {
  if (currentCents.value <= 0 || currentCents.value > remainingAbsCents.value)
    return false
  if (
    currentCents.value === remainingAbsCents.value &&
    entries.value.length === 0
  )
    return false
  return true
})

const canFinish = computed(() => {
  const inputValid =
    currentCents.value > 0 && currentCents.value <= remainingAbsCents.value

  // 0 entries + valid input that's less than total → 2-way split
  if (
    entries.value.length === 0 &&
    inputValid &&
    currentCents.value < totalAbsCents.value
  )
    return true
  // 1+ entries with remaining → auto-create remainder (with or without valid input)
  if (entries.value.length >= 1 && remainingAbsCents.value > 0) {
    return currentCents.value === 0 || inputValid
  }
  // 2+ entries exactly sum to total
  if (entries.value.length >= 2 && remainingAbsCents.value === 0) return true

  return false
})

const pendingCents = computed(() =>
  currentCents.value > 0
    ? Math.min(currentCents.value, remainingAbsCents.value)
    : 0,
)

const allocationPercent = computed(() => {
  if (totalAbsCents.value === 0) return 0
  return Math.round(
    ((enteredAbsCents.value + pendingCents.value) / totalAbsCents.value) * 100,
  )
})

const effectiveRemainingAbsCents = computed(
  () => remainingAbsCents.value - pendingCents.value,
)

const inputsDisabled = computed(
  () => remainingAbsCents.value === 0 && currentCents.value === 0,
)

function signedAmount(absCents: number): number {
  return isNegative.value ? -absCents : absCents
}

function eurosToCents(euros: string): number {
  const cleaned = euros.replace(',', '.')
  const val = parseFloat(cleaned)
  if (isNaN(val) || val <= 0) return 0
  return Math.round(val * 100)
}

function addSplit() {
  if (!canAddSplit.value) return
  entries.value.push({
    amountEuros: currentAmount.value,
    label: currentLabel.value,
  })
  currentAmount.value = ''
  currentLabel.value = ''
}

function removeSplit(index: number) {
  entries.value.splice(index, 1)
}

function finish() {
  if (!canFinish.value) return

  const splits: { amountCents: number; label?: string }[] = entries.value.map(
    (e) => {
      const absCents = eurosToCents(e.amountEuros)
      return {
        amountCents: isNegative.value ? -absCents : absCents,
        ...(e.label ? { label: e.label } : {}),
      }
    },
  )

  if (currentCents.value > 0 && currentCents.value <= remainingAbsCents.value) {
    // Include current input as a split
    splits.push({
      amountCents: isNegative.value ? -currentCents.value : currentCents.value,
      ...(currentLabel.value ? { label: currentLabel.value } : {}),
    })
    // Auto-create remainder if anything left after current input
    const afterInput = remainingAbsCents.value - currentCents.value
    if (afterInput > 0) {
      splits.push({
        amountCents: isNegative.value ? -afterInput : afterInput,
      })
    }
  } else if (remainingAbsCents.value > 0) {
    // No current input, auto-create remainder
    splits.push({
      amountCents: isNegative.value
        ? -remainingAbsCents.value
        : remainingAbsCents.value,
    })
  }

  emit('split', splits)
}

function handleEnter() {
  if (entries.value.length === 0 && canFinish.value) {
    finish()
  } else if (canAddSplit.value) {
    addSplit()
  }
}

// Reset state when dialog opens
watch(
  () => props.open,
  (open) => {
    if (open) {
      entries.value = []
      currentAmount.value = ''
      currentLabel.value = ''
    }
  },
)
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Transaktion aufteilen</DialogTitle>
        <DialogDescription v-if="transaction">
          {{ transaction.counterparty ?? transaction.description }} &mdash;
          {{ formatAmount(transaction.amountCents) }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <!-- Entered splits: only show when 2+ entries -->
        <div v-if="entries.length >= 2" class="space-y-2">
          <div
            v-for="(entry, i) in entries"
            :key="i"
            class="flex items-center justify-between rounded-lg border px-3 py-2"
          >
            <div>
              <span class="font-medium">{{
                formatAmount(
                  isNegative
                    ? -eurosToCents(entry.amountEuros)
                    : eurosToCents(entry.amountEuros),
                )
              }}</span>
              <span
                v-if="entry.label"
                class="text-muted-foreground ml-2 text-sm"
              >
                {{ entry.label }}
              </span>
            </div>
            <Button variant="ghost" size="icon" @click="removeSplit(i)">
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>

        <Separator v-if="entries.length >= 2" />

        <!-- Input area -->
        <div class="grid grid-cols-[1fr_1.5fr] gap-3">
          <div class="space-y-1.5">
            <Label for="split-amount">Betrag (EUR)</Label>
            <Input
              id="split-amount"
              v-model="currentAmount"
              type="text"
              inputmode="decimal"
              placeholder="z.B. 60,00"
              :disabled="inputsDisabled"
              @keyup.enter="handleEnter"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="split-label">Bezeichnung</Label>
            <Input
              id="split-label"
              v-model="currentLabel"
              placeholder="Optional"
              :disabled="inputsDisabled"
              @keyup.enter="handleEnter"
            />
          </div>
        </div>

        <!-- Live allocation progress -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Aufgeteilt</span>
            <span class="tabular-nums">
              {{ formatAmount(signedAmount(enteredAbsCents + pendingCents)) }}
              von {{ formatAmount(signedAmount(totalAbsCents)) }}
            </span>
          </div>
          <Progress :model-value="allocationPercent" class="h-1.5" />
          <p
            v-if="effectiveRemainingAbsCents > 0"
            class="text-muted-foreground text-xs"
          >
            Verbleibend:
            {{ formatAmount(signedAmount(effectiveRemainingAbsCents)) }}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" :disabled="!canAddSplit" @click="addSplit">
          Weiter
        </Button>
        <Button :disabled="!canFinish" @click="finish"> Fertig </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
