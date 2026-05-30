<script setup lang="ts">
import { ref, watch } from 'vue'
import type { TransactionWithCategory } from '@/lib/transactions'
import type { Category } from '@/lib/categories'
import { mutateJson } from '@/lib/http'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-vue-next'
import AmountInputGroup from '@/components/shared/AmountInputGroup.vue'

const props = defineProps<{
  transaction: TransactionWithCategory | null
  categories: Category[]
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  updated: []
  error: [message: string]
}>()

const isSaving = ref(false)
const editName = ref('')
const editNote = ref('')
const editDueDate = ref('')
const editAmount = ref(0)
const editType = ref<'income' | 'expense'>('expense')
const editCategoryId = ref<string | null>(null)
const editIsDone = ref(false)
const editIsBudget = ref(false)

watch(
  () => props.transaction,
  (transaction) => {
    if (transaction) {
      // If plan is archived, close the dialog and don't allow editing
      if (transaction.planIsArchived) {
        open.value = false
        emit(
          'error',
          'Transaktion kann nicht bearbeitet werden - Plan ist archiviert',
        )
        return
      }

      editName.value = transaction.name
      editNote.value = transaction.note ?? ''
      editDueDate.value = transaction.dueDate
      editAmount.value = transaction.amount / 100
      editType.value = transaction.type
      editCategoryId.value = transaction.categoryId
      editIsDone.value = Boolean(transaction.isDone)
      editIsBudget.value = Boolean(transaction.isBudget)
    }
  },
  { immediate: true },
)

async function handleSubmit() {
  if (!props.transaction || !editName.value.trim() || !editDueDate.value) return

  isSaving.value = true
  await mutateJson({
    url: `/api/transactions/${props.transaction.id}`,
    method: 'PUT',
    body: {
      name: editName.value.trim(),
      note: editNote.value.trim() || null,
      dueDate: editDueDate.value,
      amount: Math.round(editAmount.value * 100),
      type: editType.value,
      categoryId: editCategoryId.value,
      isDone: editIsDone.value,
      isBudget: editIsBudget.value,
    },
    notOkMessage: 'Fehler beim Speichern',
    fallbackMessage: 'Transaktion konnte nicht gespeichert werden.',
    onSuccess: () => {
      open.value = false
      emit('updated')
    },
    onError: (message) => emit('error', message),
  })
  isSaving.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Transaktion bearbeiten</DialogTitle>
        <DialogDescription>
          Bearbeiten Sie die Details dieser Transaktion.
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <Label for="edit-name">Name</Label>
          <Input
            id="edit-name"
            v-model="editName"
            placeholder="Name der Transaktion"
            required
          />
        </div>

        <div class="space-y-2">
          <Label for="edit-note">Notiz (optional)</Label>
          <textarea
            id="edit-note"
            v-model="editNote"
            placeholder="Zusätzliche Notizen..."
            class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div class="space-y-2">
          <Label for="edit-date">Datum</Label>
          <Input id="edit-date" v-model="editDueDate" type="date" required />
        </div>

        <div class="space-y-2">
          <Label>Betrag</Label>
          <AmountInputGroup
            v-model:amount="editAmount"
            v-model:type="editType"
          />
          <p class="text-muted-foreground text-xs">
            {{ editType === 'income' ? 'Einnahme' : 'Ausgabe' }} - Klicken Sie
            auf das Symbol, um zu wechseln.
          </p>
        </div>

        <div class="space-y-2">
          <Label for="edit-category">Kategorie</Label>
          <Select v-model="editCategoryId">
            <SelectTrigger>
              <SelectValue placeholder="Kategorie auswählen" />
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
        </div>

        <div class="flex items-center gap-6">
          <div class="flex items-center gap-2">
            <Switch id="edit-done" v-model="editIsDone" />
            <Label for="edit-done" class="cursor-pointer">Erledigt</Label>
          </div>
          <div class="flex items-center gap-2">
            <Switch id="edit-is-budget" v-model="editIsBudget" />
            <Label for="edit-is-budget" class="cursor-pointer">Budget</Label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            Abbrechen
          </Button>
          <Button
            type="submit"
            :disabled="isSaving || !editName.trim() || !editDueDate"
          >
            <Loader2 v-if="isSaving" class="size-4 animate-spin" />
            Speichern
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
