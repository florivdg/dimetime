<script setup lang="ts">
import { ref } from 'vue'
import type { Category } from '@/lib/categories'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Minus, Plus } from 'lucide-vue-next'

const props = defineProps<{
  planId: string
  categories: Category[]
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  created: []
  error: [message: string]
}>()

const isCreating = ref(false)
const newName = ref('')
const newNote = ref('')
const newDueDate = ref('')
const newAmount = ref(0)
const newType = ref<'income' | 'expense'>('expense')
const newCategoryId = ref<string | null>(null)
const newIsDone = ref(false)

function resetForm() {
  newName.value = ''
  newNote.value = ''
  newDueDate.value = ''
  newAmount.value = 0
  newType.value = 'expense'
  newCategoryId.value = null
  newIsDone.value = false
}

function toggleType() {
  newType.value = newType.value === 'income' ? 'expense' : 'income'
}

async function handleSubmit() {
  if (!newName.value.trim() || !newDueDate.value) return

  isCreating.value = true

  try {
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.value.trim(),
        note: newNote.value.trim() || null,
        dueDate: newDueDate.value,
        amount: Math.round(newAmount.value * 100),
        type: newType.value,
        planId: props.planId,
        categoryId: newCategoryId.value,
        isDone: newIsDone.value,
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Fehler beim Erstellen')
    }

    resetForm()
    open.value = false
    emit('created')
  } catch (error) {
    emit(
      'error',
      error instanceof Error
        ? error.message
        : 'Transaktion konnte nicht erstellt werden.',
    )
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button>
        <Plus class="size-4" />
        Neue Transaktion
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Neue Transaktion</DialogTitle>
        <DialogDescription>
          Erstellen Sie eine neue Transaktion für diesen Plan.
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <Label for="new-name">Name</Label>
          <Input
            id="new-name"
            v-model="newName"
            placeholder="Name der Transaktion"
            required
          />
        </div>

        <div class="space-y-2">
          <Label for="new-note">Notiz (optional)</Label>
          <textarea
            id="new-note"
            v-model="newNote"
            placeholder="Zusätzliche Notizen..."
            class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div class="space-y-2">
          <Label for="new-date">Datum</Label>
          <Input id="new-date" v-model="newDueDate" type="date" required />
        </div>

        <div class="space-y-2">
          <Label>Betrag</Label>
          <InputGroup>
            <InputGroupAddon>
              <InputGroupButton
                type="button"
                :class="
                  newType === 'income'
                    ? 'text-lime-600 hover:bg-lime-50 hover:text-lime-700 dark:hover:bg-lime-950'
                    : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950'
                "
                @click="toggleType"
              >
                <Plus v-if="newType === 'income'" class="size-4" />
                <Minus v-else class="size-4" />
              </InputGroupButton>
            </InputGroupAddon>
            <InputGroupInput
              v-model.number="newAmount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
            />
          </InputGroup>
          <p class="text-muted-foreground text-xs">
            {{ newType === 'income' ? 'Einnahme' : 'Ausgabe' }} - Klicken Sie
            auf das Symbol, um zu wechseln.
          </p>
        </div>

        <div class="space-y-2">
          <Label for="new-category">Kategorie</Label>
          <Select v-model="newCategoryId">
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

        <div class="flex items-center gap-2">
          <Checkbox id="new-done" v-model="newIsDone" />
          <Label for="new-done" class="cursor-pointer">Erledigt</Label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            Abbrechen
          </Button>
          <Button
            type="submit"
            :disabled="isCreating || !newName.trim() || !newDueDate"
          >
            <Loader2 v-if="isCreating" class="size-4 animate-spin" />
            Erstellen
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
