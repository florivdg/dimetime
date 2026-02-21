<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type {
  KassensturzPlannedItem,
  KassensturzManualEntry,
} from '@/lib/kassensturz'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const props = defineProps<{
  plannedItems: KassensturzPlannedItem[]
  editEntry?: KassensturzManualEntry | null
  preselectedPlannedItemId?: string | null
  defaultType?: 'income' | 'expense'
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  save: [
    data: {
      name: string
      note?: string
      amountCents: number
      type: 'income' | 'expense'
      plannedTransactionId?: string
    },
  ]
  update: [
    data: {
      entryId: string
      name: string
      note?: string | null
      amountCents: number
      type: 'income' | 'expense'
      plannedTransactionId?: string | null
    },
  ]
}>()

const name = ref('')
const amountEur = ref('')
const type = ref<'income' | 'expense'>('expense')
const note = ref('')
const plannedTransactionId = ref<string | undefined>(undefined)

const isEditing = computed(() => !!props.editEntry)
const title = computed(() =>
  isEditing.value ? 'Manuellen Eintrag bearbeiten' : 'Manueller Eintrag',
)

watch(open, (isOpen) => {
  if (isOpen) {
    if (props.editEntry) {
      name.value = props.editEntry.name
      amountEur.value = (Math.abs(props.editEntry.amountCents) / 100).toFixed(2)
      type.value = props.editEntry.type
      note.value = props.editEntry.note ?? ''
      plannedTransactionId.value =
        props.editEntry.plannedTransactionId ?? undefined
    } else {
      name.value = ''
      amountEur.value = ''
      type.value = props.defaultType ?? 'expense'
      note.value = ''
      plannedTransactionId.value = props.preselectedPlannedItemId ?? undefined
    }
  }
})

function handleSave() {
  const cents = Math.round(parseFloat(amountEur.value) * 100)
  if (isNaN(cents) || cents <= 0) return

  if (isEditing.value && props.editEntry) {
    emit('update', {
      entryId: props.editEntry.id,
      name: name.value,
      note: note.value || null,
      amountCents: cents,
      type: type.value,
      plannedTransactionId: plannedTransactionId.value ?? null,
    })
  } else {
    emit('save', {
      name: name.value,
      note: note.value || undefined,
      amountCents: cents,
      type: type.value,
      plannedTransactionId: plannedTransactionId.value,
    })
  }
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>
          Erfasse einen manuellen Bestand (z.B. Bargeld, PayPal-Guthaben).
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="manual-name">Name</Label>
          <Input
            id="manual-name"
            v-model="name"
            placeholder="z.B. Bargeld, PayPal-Guthaben"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="manual-amount">Betrag (€)</Label>
            <Input
              id="manual-amount"
              v-model="amountEur"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
            />
          </div>

          <div class="space-y-2">
            <Label for="manual-type">Typ</Label>
            <Select v-model="type">
              <SelectTrigger id="manual-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Einnahme</SelectItem>
                <SelectItem value="expense">Ausgabe</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="manual-planned">Zuordnung (optional)</Label>
          <Select
            :model-value="plannedTransactionId ?? '__none__'"
            @update:model-value="
              (v) =>
                (plannedTransactionId =
                  v === '__none__' ? undefined : String(v))
            "
          >
            <SelectTrigger id="manual-planned">
              <SelectValue placeholder="Keinem Posten zuordnen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Keine Zuordnung</SelectItem>
              <SelectItem
                v-for="item in plannedItems"
                :key="item.id"
                :value="item.id"
              >
                {{ item.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <Label for="manual-note">Notiz (optional)</Label>
          <Textarea
            id="manual-note"
            v-model="note"
            rows="2"
            placeholder="Optionale Anmerkung"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">Abbrechen</Button>
        <Button
          :disabled="!name.trim() || !amountEur || parseFloat(amountEur) <= 0"
          @click="handleSave"
        >
          {{ isEditing ? 'Speichern' : 'Erstellen' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
