<script setup lang="ts">
import { ref } from 'vue'
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
import { Label } from '@/components/ui/label'
import { Loader2, Plus } from 'lucide-vue-next'

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  created: []
  error: [message: string]
}>()

const isCreating = ref(false)
const newName = ref('')
const newSlug = ref('')
const newColor = ref('#6366f1')

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function onNameBlur() {
  if (!newSlug.value) {
    newSlug.value = generateSlug(newName.value)
  }
}

function resetForm() {
  newName.value = ''
  newSlug.value = ''
  newColor.value = '#6366f1'
}

async function handleSubmit() {
  if (!newName.value.trim()) return

  isCreating.value = true

  try {
    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.value.trim(),
        slug: newSlug.value.trim() || undefined,
        color: newColor.value || null,
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
        : 'Kategorie konnte nicht erstellt werden.',
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
        Neue Kategorie
      </Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Neue Kategorie erstellen</DialogTitle>
        <DialogDescription>
          Erstellen Sie eine neue Kategorie für Ihre Transaktionen.
        </DialogDescription>
      </DialogHeader>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="space-y-2">
          <Label for="new-name">Name</Label>
          <Input
            id="new-name"
            v-model="newName"
            placeholder="z.B. Miete"
            data-1p-ignore
            @blur="onNameBlur"
          />
        </div>
        <div class="space-y-2">
          <Label for="new-slug">Slug</Label>
          <Input
            id="new-slug"
            v-model="newSlug"
            placeholder="z.B. miete"
            class="font-mono"
          />
          <p class="text-muted-foreground text-xs">
            Wird automatisch aus dem Namen generiert.
          </p>
        </div>
        <div class="space-y-2">
          <Label for="new-color">Farbe</Label>
          <div class="flex items-center gap-2">
            <input
              id="new-color"
              v-model="newColor"
              type="color"
              class="h-10 w-14 cursor-pointer rounded border p-1"
            />
            <Input v-model="newColor" placeholder="#6366f1" class="font-mono" />
          </div>
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
