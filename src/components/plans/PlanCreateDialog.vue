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
const newDate = ref('')
const newNotes = ref('')

function resetForm() {
  newName.value = ''
  newDate.value = ''
  newNotes.value = ''
}

async function handleSubmit() {
  if (!newDate.value.trim()) return

  isCreating.value = true

  try {
    const response = await fetch('/api/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.value.trim() || null,
        date: newDate.value,
        notes: newNotes.value.trim() || null,
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
        : 'Plan konnte nicht erstellt werden.',
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
        Neuer Plan
      </Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Neuen Plan erstellen</DialogTitle>
        <DialogDescription>
          Erstellen Sie einen neuen Finanzplan.
        </DialogDescription>
      </DialogHeader>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="space-y-2">
          <Label for="new-name">Name (optional)</Label>
          <Input
            id="new-name"
            v-model="newName"
            placeholder="z.B. Dezember 2025"
            data-1p-ignore
          />
          <p class="text-muted-foreground text-xs">
            Wird automatisch aus dem Datum generiert, wenn leer.
          </p>
        </div>
        <div class="space-y-2">
          <Label for="new-date">Datum</Label>
          <Input id="new-date" v-model="newDate" type="date" />
        </div>
        <div class="space-y-2">
          <Label for="new-notes">Notizen (optional)</Label>
          <textarea
            id="new-notes"
            v-model="newNotes"
            placeholder="Notizen zum Plan..."
            class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            Abbrechen
          </Button>
          <Button type="submit" :disabled="isCreating || !newDate.trim()">
            <Loader2 v-if="isCreating" class="size-4 animate-spin" />
            Erstellen
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
