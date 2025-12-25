<script setup lang="ts">
import { formatAmount, formatDate } from '@/lib/format'
import type { TransactionWithCategory } from '@/lib/transactions'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  Lock,
  Pencil,
  Receipt,
  Search,
  Trash2,
} from 'lucide-vue-next'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const props = defineProps<{
  transactions: TransactionWithCategory[]
  isLoading: boolean
  searchQuery: string
  sortBy: 'name' | 'dueDate' | 'categoryName' | 'amount'
  sortDir: 'asc' | 'desc'
}>()

const emit = defineEmits<{
  edit: [transaction: TransactionWithCategory]
  move: [transaction: TransactionWithCategory]
  deleted: []
  error: [message: string]
  sort: [column: 'name' | 'dueDate' | 'categoryName' | 'amount']
  toggleDone: [id: string, isDone: boolean]
}>()

async function deleteTransaction(id: string) {
  try {
    const response = await fetch(`/api/transactions/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Fehler beim Löschen')
    }

    emit('deleted')
  } catch (error) {
    emit(
      'error',
      error instanceof Error
        ? error.message
        : 'Transaktion konnte nicht gelöscht werden.',
    )
  }
}

function handleToggleDone(transaction: TransactionWithCategory) {
  emit('toggleDone', transaction.id, !transaction.isDone)
}

function getSortIcon(column: 'name' | 'dueDate' | 'categoryName' | 'amount') {
  if (props.sortBy !== column) return ArrowUpDown
  return props.sortDir === 'asc' ? ArrowUp : ArrowDown
}

function isTransactionReadOnly(transaction: TransactionWithCategory): boolean {
  return transaction.planIsArchived === true
}
</script>

<template>
  <!-- Loading -->
  <div v-if="isLoading" class="flex items-center justify-center py-8">
    <Loader2 class="text-muted-foreground size-6 animate-spin" />
  </div>

  <!-- Empty state -->
  <div
    v-else-if="transactions.length === 0 && !searchQuery"
    class="py-8 text-center"
  >
    <Receipt class="text-muted-foreground mx-auto mb-4 size-12" />
    <p class="text-muted-foreground">Keine Transaktionen vorhanden.</p>
  </div>

  <!-- No results -->
  <div
    v-else-if="transactions.length === 0 && searchQuery"
    class="py-8 text-center"
  >
    <Search class="text-muted-foreground mx-auto mb-4 size-12" />
    <p class="text-muted-foreground">
      Keine Transaktionen gefunden für "{{ searchQuery }}".
    </p>
  </div>

  <!-- Table -->
  <div v-else class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-12">
            <span class="sr-only">Status</span>
          </TableHead>
          <TableHead>
            <Button
              variant="ghost"
              size="sm"
              class="-ml-3"
              @click="emit('sort', 'name')"
            >
              Name
              <component :is="getSortIcon('name')" class="ml-2 size-4" />
            </Button>
          </TableHead>
          <TableHead class="w-36">
            <Button
              variant="ghost"
              size="sm"
              class="-ml-3"
              @click="emit('sort', 'dueDate')"
            >
              Datum
              <component :is="getSortIcon('dueDate')" class="ml-2 size-4" />
            </Button>
          </TableHead>
          <TableHead>
            <Button
              variant="ghost"
              size="sm"
              class="-ml-3"
              @click="emit('sort', 'categoryName')"
            >
              Kategorie
              <component
                :is="getSortIcon('categoryName')"
                class="ml-2 size-4"
              />
            </Button>
          </TableHead>
          <TableHead class="w-36">
            <Button
              variant="ghost"
              size="sm"
              class="-ml-3"
              @click="emit('sort', 'amount')"
            >
              Betrag
              <component :is="getSortIcon('amount')" class="ml-2 size-4" />
            </Button>
          </TableHead>
          <TableHead class="w-24 text-right">Aktionen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="transaction in transactions"
          :key="transaction.id"
          :class="{ 'opacity-60': transaction.isDone }"
        >
          <!-- Status -->
          <TableCell>
            <TooltipProvider v-if="isTransactionReadOnly(transaction)">
              <Tooltip>
                <TooltipTrigger as-child>
                  <div class="flex items-center">
                    <Lock class="text-muted-foreground size-4" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Plan ist archiviert - Transaktion ist schreibgeschützt</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Checkbox
              v-else
              :model-value="Boolean(transaction.isDone)"
              @update:model-value="handleToggleDone(transaction)"
            />
          </TableCell>

          <!-- Name -->
          <TableCell>
            <span :class="{ 'line-through': transaction.isDone }">
              {{ transaction.name }}
            </span>
          </TableCell>

          <!-- Date -->
          <TableCell>
            {{ formatDate(transaction.dueDate) }}
          </TableCell>

          <!-- Category -->
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

          <!-- Amount -->
          <TableCell>
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

          <!-- Actions -->
          <TableCell class="text-right">
            <!-- Read-only: show lock icon -->
            <div
              v-if="isTransactionReadOnly(transaction)"
              class="flex justify-end"
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <div class="text-muted-foreground flex items-center gap-1">
                      <Lock class="size-4" />
                      <span class="sr-only">Schreibgeschützt</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Plan ist archiviert - Transaktion ist schreibgeschützt
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <!-- Editable: show edit/delete buttons -->
            <div v-else class="flex justify-end gap-1">
              <Button
                size="icon-sm"
                variant="ghost"
                title="Verschieben"
                @click="emit('move', transaction)"
              >
                <ArrowRightLeft class="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                title="Bearbeiten"
                @click="emit('edit', transaction)"
              >
                <Pencil class="size-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger as-child>
                  <Button size="icon-sm" variant="ghost" title="Löschen">
                    <Trash2 class="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Transaktion löschen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Möchten Sie die Transaktion "{{ transaction.name }}"
                      wirklich löschen? Diese Aktion kann nicht rückgängig
                      gemacht werden.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      @click="deleteTransaction(transaction.id)"
                    >
                      Löschen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
