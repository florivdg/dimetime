<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import type { TransactionWithCategory } from '@/lib/transactions'
import type { Category } from '@/lib/categories'
import { getPlanDisplayName } from '@/lib/format'
import { Button } from '@/components/ui/button'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  X,
} from 'lucide-vue-next'

const props = defineProps<{
  transactions: TransactionWithCategory[]
  isLoading: boolean
  searchQuery: string
  sortBy: 'name' | 'dueDate' | 'categoryName' | 'amount'
  sortDir: 'asc' | 'desc'
  categories: Category[]
}>()

const emit = defineEmits<{
  updated: []
  deleted: []
  error: [message: string]
  sort: [column: 'name' | 'dueDate' | 'categoryName' | 'amount']
}>()

// Delete confirmation state
const deleteConfirmation = ref('')
const isDeleteConfirmed = computed(
  () => deleteConfirmation.value.toLowerCase() === 'löschen',
)

function resetDeleteConfirmation() {
  deleteConfirmation.value = ''
}

// Edit state
const editingId = ref<string | null>(null)
const editName = ref('')
const editDueDate = ref('')
const editAmount = ref(0)
const editType = ref<'income' | 'expense'>('expense')
const editCategoryId = ref<string | null>(null)
const editInputRefs = ref<
  Record<string, HTMLInputElement | ComponentPublicInstance | null>
>({})

function setEditInputRef(
  id: string,
  el: HTMLInputElement | ComponentPublicInstance | null,
) {
  if (el === null) {
    delete editInputRefs.value[id]
    return
  }
  editInputRefs.value[id] = el
}

function focusEditInput(id: string) {
  const refValue = editInputRefs.value[id]
  const inputEl =
    refValue instanceof HTMLInputElement
      ? refValue
      : (refValue as ComponentPublicInstance | undefined)?.$el
  if (inputEl instanceof HTMLInputElement) {
    inputEl.focus()
    inputEl.select?.()
  }
}

function startEditing(transaction: TransactionWithCategory) {
  editingId.value = transaction.id
  editName.value = transaction.name
  editDueDate.value = transaction.dueDate
  editAmount.value = transaction.amount / 100 // Convert cents to euros for display
  editType.value = transaction.type
  editCategoryId.value = transaction.categoryId
  nextTick(() => {
    focusEditInput(transaction.id)
  })
}

function cancelEditing() {
  editingId.value = null
  editName.value = ''
  editDueDate.value = ''
  editAmount.value = 0
  editType.value = 'expense'
  editCategoryId.value = null
}

function toggleType() {
  editType.value = editType.value === 'income' ? 'expense' : 'income'
}

async function updateTransaction(id: string) {
  const payload = {
    name: editName.value.trim(),
    dueDate: editDueDate.value,
    amount: Math.round(editAmount.value * 100), // Convert euros to cents
    type: editType.value,
    categoryId: editCategoryId.value,
  }
  try {
    const response = await fetch(`/api/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Fehler beim Aktualisieren')
    }

    cancelEditing()
    emit('updated')
  } catch (error) {
    emit(
      'error',
      error instanceof Error
        ? error.message
        : 'Transaktion konnte nicht aktualisiert werden.',
    )
  }
}

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

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
  }).format(new Date(dateString))
}

function formatAmount(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

function getSortIcon(column: 'name' | 'dueDate' | 'categoryName' | 'amount') {
  if (props.sortBy !== column) return ArrowUpDown
  return props.sortDir === 'asc' ? ArrowUp : ArrowDown
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
          <TableHead>Plan</TableHead>
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
        <TableRow v-for="transaction in transactions" :key="transaction.id">
          <!-- Name -->
          <TableCell>
            <Input
              v-if="editingId === transaction.id"
              :ref="
                (el) => setEditInputRef(transaction.id, el as HTMLInputElement)
              "
              v-model="editName"
              class="h-8"
              placeholder="Name..."
              @keyup.enter="updateTransaction(transaction.id)"
              @keyup.escape="cancelEditing"
            />
            <span v-else class="font-medium">{{ transaction.name }}</span>
          </TableCell>

          <!-- Date -->
          <TableCell>
            <Input
              v-if="editingId === transaction.id"
              v-model="editDueDate"
              type="date"
              class="h-8"
              @keyup.enter="updateTransaction(transaction.id)"
              @keyup.escape="cancelEditing"
            />
            <span v-else>{{ formatDate(transaction.dueDate) }}</span>
          </TableCell>

          <!-- Category -->
          <TableCell>
            <Select
              v-if="editingId === transaction.id"
              v-model="editCategoryId"
            >
              <SelectTrigger class="h-8">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="null">Keine Kategorie</SelectItem>
                <SelectItem
                  v-for="cat in categories"
                  :key="cat.id"
                  :value="cat.id"
                >
                  {{ cat.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <div v-else class="flex items-center gap-2">
              <span
                v-if="transaction.categoryColor"
                class="size-3 shrink-0 rounded-full"
                :style="{ backgroundColor: transaction.categoryColor }"
              />
              <span>{{ transaction.categoryName || '-' }}</span>
            </div>
          </TableCell>

          <!-- Plan -->
          <TableCell>
            <a
              v-if="transaction.planId"
              :href="`/plans/${transaction.planId}`"
              class="hover:underline"
            >
              {{
                getPlanDisplayName(transaction.planName, transaction.planDate)
              }}
            </a>
            <span v-else class="text-muted-foreground">-</span>
          </TableCell>

          <!-- Amount -->
          <TableCell>
            <InputGroup v-if="editingId === transaction.id" class="h-8">
              <InputGroupAddon>
                <InputGroupButton
                  :class="
                    editType === 'income'
                      ? 'text-green-600 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950'
                      : 'text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950'
                  "
                  @click="toggleType"
                >
                  <Plus v-if="editType === 'income'" class="size-4" />
                  <Minus v-else class="size-4" />
                </InputGroupButton>
              </InputGroupAddon>
              <InputGroupInput
                v-model.number="editAmount"
                type="number"
                step="0.01"
                @keyup.enter="updateTransaction(transaction.id)"
                @keyup.escape="cancelEditing"
              />
            </InputGroup>
            <span
              v-else
              :class="
                transaction.type === 'income'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              "
            >
              {{ transaction.type === 'income' ? '+' : '-'
              }}{{ formatAmount(transaction.amount) }}
            </span>
          </TableCell>

          <!-- Actions -->
          <TableCell class="text-right">
            <div
              v-if="editingId === transaction.id"
              class="flex justify-end gap-1"
            >
              <Button
                size="icon-sm"
                variant="ghost"
                title="Speichern"
                @click="updateTransaction(transaction.id)"
              >
                <Check class="size-4" />
                <span class="sr-only">Speichern</span>
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                title="Abbrechen"
                @click="cancelEditing"
              >
                <X class="size-4" />
                <span class="sr-only">Abbrechen</span>
              </Button>
            </div>
            <div v-else class="flex justify-end gap-1">
              <Button
                size="icon-sm"
                variant="ghost"
                title="Bearbeiten"
                @click="startEditing(transaction)"
              >
                <Pencil class="size-4" />
              </Button>
              <AlertDialog @update:open="resetDeleteConfirmation">
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
                  <div class="space-y-2">
                    <Label for="delete-confirmation">
                      Geben Sie
                      <span class="font-semibold">löschen</span>
                      ein, um fortzufahren:
                    </Label>
                    <Input
                      id="delete-confirmation"
                      v-model="deleteConfirmation"
                      placeholder="löschen"
                      autocomplete="off"
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      :disabled="!isDeleteConfirmed"
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
