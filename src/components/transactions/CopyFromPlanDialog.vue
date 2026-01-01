<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Plan } from '@/lib/plans'
import type { TransactionWithCategory } from '@/lib/transactions'
import { formatAmount, formatDate, getPlanDisplayName } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Receipt } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const props = defineProps<{
  planId: string
  planDate: string
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  copied: [count: number]
  error: [message: string]
}>()

// State
const isLoadingPlans = ref(false)
const isLoadingTransactions = ref(false)
const isCopying = ref(false)
const availablePlans = ref<Plan[]>([])
const selectedPlanId = ref<string | null>(null)
const transactions = ref<TransactionWithCategory[]>([])
const selectedTransactionIds = ref<Set<string>>(new Set())

// Computed
const selectablePlans = computed(() =>
  availablePlans.value.filter((p) => p.id !== props.planId),
)

const hasTransactions = computed(() => transactions.value.length > 0)
const hasSelectedTransactions = computed(
  () => selectedTransactionIds.value.size > 0,
)
const selectedCount = computed(() => selectedTransactionIds.value.size)

// Load plans when dialog opens
watch(open, async (isOpen) => {
  if (isOpen) {
    selectedPlanId.value = null
    transactions.value = []
    selectedTransactionIds.value = new Set()
    await loadPlans()
  }
})

// Load transactions when plan is selected
watch(selectedPlanId, async (planId) => {
  if (planId) {
    await loadTransactions(planId)
  } else {
    transactions.value = []
    selectedTransactionIds.value = new Set()
  }
})

async function loadPlans() {
  isLoadingPlans.value = true
  try {
    const response = await fetch('/api/plans?includeArchived=true')
    if (!response.ok) throw new Error('Fehler beim Laden der Pläne')
    const data = await response.json()
    availablePlans.value = data.plans
  } catch {
    emit('error', 'Pläne konnten nicht geladen werden.')
  } finally {
    isLoadingPlans.value = false
  }
}

async function loadTransactions(planId: string) {
  isLoadingTransactions.value = true
  selectedTransactionIds.value = new Set()
  try {
    const params = new URLSearchParams()
    params.set('planId', planId)
    params.set('limit', '-1')
    params.set('sortBy', 'dueDate')
    params.set('sortDir', 'asc')
    params.set('hideZeroValue', 'false')

    const response = await fetch(`/api/transactions?${params.toString()}`)
    if (!response.ok) throw new Error('Fehler beim Laden der Transaktionen')
    const data = await response.json()
    transactions.value = data.transactions
  } catch {
    emit('error', 'Transaktionen konnten nicht geladen werden.')
    transactions.value = []
  } finally {
    isLoadingTransactions.value = false
  }
}

function toggleTransaction(id: string) {
  if (selectedTransactionIds.value.has(id)) {
    selectedTransactionIds.value.delete(id)
  } else {
    selectedTransactionIds.value.add(id)
  }
  // Trigger reactivity
  selectedTransactionIds.value = new Set(selectedTransactionIds.value)
}

function selectAll() {
  selectedTransactionIds.value = new Set(transactions.value.map((t) => t.id))
}

function deselectAll() {
  selectedTransactionIds.value = new Set()
}

async function handleCopy() {
  if (!hasSelectedTransactions.value) return

  isCopying.value = true

  try {
    const response = await fetch('/api/transactions/bulk-copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetPlanId: props.planId,
        transactionIds: Array.from(selectedTransactionIds.value),
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Fehler beim Kopieren')
    }

    const data = await response.json()

    open.value = false
    toast.success(`${data.count} Transaktionen wurden kopiert`)
    emit('copied', data.count)
  } catch (error) {
    emit(
      'error',
      error instanceof Error
        ? error.message
        : 'Transaktionen konnten nicht kopiert werden.',
    )
  } finally {
    isCopying.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex max-h-[80vh] flex-col sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Transaktionen kopieren</DialogTitle>
        <DialogDescription>
          Wählen Sie einen Plan und die zu kopierenden Transaktionen. Die Tage
          werden beibehalten, der Monat wird angepasst.
        </DialogDescription>
      </DialogHeader>

      <!-- Plan selector -->
      <div class="space-y-2">
        <Label>Quellplan</Label>
        <Select v-model="selectedPlanId" :disabled="isLoadingPlans">
          <SelectTrigger class="w-full">
            <SelectValue
              :placeholder="isLoadingPlans ? 'Lädt...' : 'Plan auswählen'"
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="plan in selectablePlans"
              :key="plan.id"
              :value="plan.id"
            >
              {{ getPlanDisplayName(plan.name, plan.date) }}
              <span v-if="plan.isArchived" class="text-muted-foreground ml-1">
                (archiviert)
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        <p
          v-if="selectablePlans.length === 0 && !isLoadingPlans"
          class="text-muted-foreground text-sm"
        >
          Keine anderen Pläne verfügbar.
        </p>
      </div>

      <!-- Loading state for transactions -->
      <div
        v-if="isLoadingTransactions"
        class="flex items-center justify-center py-8"
      >
        <Loader2 class="text-muted-foreground size-6 animate-spin" />
      </div>

      <!-- Empty state -->
      <div
        v-else-if="selectedPlanId && !hasTransactions"
        class="py-8 text-center"
      >
        <Receipt class="text-muted-foreground mx-auto mb-4 size-12" />
        <p class="text-muted-foreground">Keine Transaktionen in diesem Plan.</p>
      </div>

      <!-- Transactions table -->
      <div
        v-else-if="selectedPlanId && hasTransactions"
        class="min-h-0 flex-1 overflow-auto"
      >
        <div class="mb-2 flex items-center justify-between">
          <span class="text-muted-foreground text-sm">
            {{ selectedCount }} von {{ transactions.length }} ausgewählt
          </span>
          <div class="flex gap-2">
            <Button variant="ghost" size="sm" @click="selectAll">
              Alle auswählen
            </Button>
            <Button variant="ghost" size="sm" @click="deselectAll">
              Auswahl aufheben
            </Button>
          </div>
        </div>

        <div class="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-12" />
                <TableHead>Name</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead class="text-right">Betrag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="transaction in transactions"
                :key="transaction.id"
                class="hover:bg-muted/50 cursor-pointer"
                @click="toggleTransaction(transaction.id)"
              >
                <TableCell>
                  <Checkbox
                    :model-value="selectedTransactionIds.has(transaction.id)"
                    @update:model-value="toggleTransaction(transaction.id)"
                    @click.stop
                  />
                </TableCell>
                <TableCell>
                  {{ transaction.name }}
                </TableCell>
                <TableCell>
                  {{ formatDate(transaction.dueDate) }}
                </TableCell>
                <TableCell>
                  <div class="flex items-center gap-2">
                    <span
                      v-if="transaction.categoryColor"
                      class="size-3 shrink-0 rounded-full"
                      :style="{ backgroundColor: transaction.categoryColor }"
                    />
                    <span>{{ transaction.categoryName || '-' }}</span>
                  </div>
                </TableCell>
                <TableCell class="text-right">
                  <span
                    :class="
                      transaction.type === 'income'
                        ? 'text-lime-600 dark:text-lime-400'
                        : 'text-rose-600 dark:text-rose-400'
                    "
                  >
                    {{ transaction.type === 'income' ? '+' : '-'
                    }}{{ formatAmount(transaction.amount) }}
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <DialogFooter class="mt-4">
        <Button type="button" variant="outline" @click="open = false">
          Abbrechen
        </Button>
        <Button
          type="button"
          :disabled="isCopying || !hasSelectedTransactions"
          @click="handleCopy"
        >
          <Loader2 v-if="isCopying" class="size-4 animate-spin" />
          {{ selectedCount }} Transaktionen kopieren
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
