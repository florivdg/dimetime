<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Category } from '@/lib/categories'
import { Button } from '@/components/ui/button'
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

export interface PresetInitialValues {
  name: string
  note: string | null
  amount: number // in cents
  type: 'income' | 'expense'
  categoryId: string | null
}

const props = defineProps<{
  categories: Category[]
  initialValues?: PresetInitialValues
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  created: []
  error: [message: string]
}>()

const isCreating = ref(false)
const newName = ref('')
const newNote = ref('')
const newAmount = ref(0)
const newType = ref<'income' | 'expense'>('expense')
const newRecurrence = ref<
  'einmalig' | 'monatlich' | 'vierteljährlich' | 'jährlich'
>('monatlich')
const newStartMonth = ref(getCurrentMonth())
const newEndDate = ref('')
const newCategoryId = ref<string | null>(null)

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function resetForm() {
  newName.value = ''
  newNote.value = ''
  newAmount.value = 0
  newType.value = 'expense'
  newRecurrence.value = 'monatlich'
  newStartMonth.value = getCurrentMonth()
  newEndDate.value = ''
  newCategoryId.value = null
}

watch(open, (isOpen) => {
  if (isOpen && props.initialValues) {
    newName.value = props.initialValues.name
    newNote.value = props.initialValues.note ?? ''
    newAmount.value = props.initialValues.amount / 100
    newType.value = props.initialValues.type
    newCategoryId.value = props.initialValues.categoryId
    newRecurrence.value = 'monatlich'
    newStartMonth.value = getCurrentMonth()
    newEndDate.value = ''
  } else if (isOpen) {
    resetForm()
  }
})

function toggleType() {
  newType.value = newType.value === 'income' ? 'expense' : 'income'
}

async function handleSubmit() {
  if (!newName.value.trim()) return

  isCreating.value = true

  try {
    const response = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.value.trim(),
        note: newNote.value.trim() || null,
        amount: Math.round(newAmount.value * 100),
        type: newType.value,
        recurrence: newRecurrence.value,
        startMonth: newStartMonth.value || null,
        endDate: newEndDate.value || null,
        categoryId: newCategoryId.value,
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
        : 'Vorlage konnte nicht erstellt werden.',
    )
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger v-if="$slots.default" as-child>
      <slot />
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {{ initialValues ? 'Vorlage aus Transaktion' : 'Neue Vorlage' }}
        </DialogTitle>
        <DialogDescription>
          {{
            initialValues
              ? 'Erstellen Sie eine Vorlage basierend auf einer bestehenden Transaktion.'
              : 'Erstellen Sie eine Vorlage für wiederkehrende Transaktionen.'
          }}
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <Label for="new-name">Name</Label>
          <Input
            id="new-name"
            v-model="newName"
            placeholder="Name der Vorlage"
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
          <Label for="new-category">Kategorie (optional)</Label>
          <Select v-model="newCategoryId">
            <SelectTrigger id="new-category">
              <SelectValue placeholder="Kategorie wählen" />
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

        <div class="space-y-2">
          <Label for="new-recurrence">Wiederholung</Label>
          <Select v-model="newRecurrence">
            <SelectTrigger id="new-recurrence">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="einmalig">Einmalig</SelectItem>
              <SelectItem value="monatlich">Monatlich</SelectItem>
              <SelectItem value="vierteljährlich">Vierteljährlich</SelectItem>
              <SelectItem value="jährlich">Jährlich</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <Label for="new-start-month">Startmonat</Label>
          <Input
            id="new-start-month"
            v-model="newStartMonth"
            type="month"
            required
          />
          <p class="text-muted-foreground text-xs">
            Ab welchem Monat soll diese Vorlage gelten?
          </p>
        </div>

        <div class="space-y-2">
          <Label for="new-end-date">Enddatum (optional)</Label>
          <Input id="new-end-date" v-model="newEndDate" type="date" />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            Abbrechen
          </Button>
          <Button type="submit" :disabled="isCreating || !newName.trim()">
            <Loader2 v-if="isCreating" class="size-4 animate-spin" />
            Erstellen
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
