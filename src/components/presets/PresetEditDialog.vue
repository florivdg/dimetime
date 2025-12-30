<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Category } from '@/lib/categories'
import type { PresetWithTags } from '@/lib/presets'
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
  preset: PresetWithTags | null
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
const editAmount = ref(0)
const editType = ref<'income' | 'expense'>('expense')
const editRecurrence = ref<
  'einmalig' | 'monatlich' | 'vierteljährlich' | 'jährlich'
>('einmalig')
const editEndDate = ref('')
const editCategoryId = ref<string | null>(null)

// Populate form when preset prop changes
watch(
  () => props.preset,
  (newPreset) => {
    if (newPreset) {
      editName.value = newPreset.name
      editNote.value = newPreset.note || ''
      editAmount.value = newPreset.amount / 100 // Convert cents to euros
      editType.value = newPreset.type
      editRecurrence.value = newPreset.recurrence
      editEndDate.value = newPreset.endDate || ''
      editCategoryId.value = newPreset.categoryId
    }
  },
  { immediate: true },
)

function toggleType() {
  editType.value = editType.value === 'income' ? 'expense' : 'income'
}

async function handleSubmit() {
  if (!props.preset || !editName.value.trim()) return

  isSaving.value = true

  try {
    const response = await fetch(`/api/presets/${props.preset.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName.value.trim(),
        note: editNote.value.trim() || null,
        amount: Math.round(editAmount.value * 100),
        type: editType.value,
        recurrence: editRecurrence.value,
        endDate: editEndDate.value || null,
        categoryId: editCategoryId.value,
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Fehler beim Aktualisieren')
    }

    open.value = false
    emit('updated')
  } catch (error) {
    emit(
      'error',
      error instanceof Error
        ? error.message
        : 'Vorlage konnte nicht aktualisiert werden.',
    )
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Vorlage bearbeiten</DialogTitle>
        <DialogDescription>
          Bearbeiten Sie die Vorlage für wiederkehrende Transaktionen.
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <Label for="edit-name">Name</Label>
          <Input
            id="edit-name"
            v-model="editName"
            placeholder="Name der Vorlage"
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
          <Label>Betrag</Label>
          <InputGroup>
            <InputGroupAddon>
              <InputGroupButton
                type="button"
                :class="
                  editType === 'income'
                    ? 'text-lime-600 hover:bg-lime-50 hover:text-lime-700 dark:hover:bg-lime-950'
                    : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950'
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
              min="0"
              placeholder="0,00"
            />
          </InputGroup>
          <p class="text-muted-foreground text-xs">
            {{ editType === 'income' ? 'Einnahme' : 'Ausgabe' }} - Klicken Sie
            auf das Symbol, um zu wechseln.
          </p>
        </div>

        <div class="space-y-2">
          <Label for="edit-category">Kategorie (optional)</Label>
          <Select v-model="editCategoryId">
            <SelectTrigger id="edit-category">
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
          <Label for="edit-recurrence">Wiederholung</Label>
          <Select v-model="editRecurrence">
            <SelectTrigger id="edit-recurrence">
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
          <Label for="edit-end-date">Enddatum (optional)</Label>
          <Input id="edit-end-date" v-model="editEndDate" type="date" />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            Abbrechen
          </Button>
          <Button type="submit" :disabled="isSaving || !editName.trim()">
            <Loader2 v-if="isSaving" class="size-4 animate-spin" />
            Speichern
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
