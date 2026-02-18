<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ImportSource } from '@/lib/bank-transactions'
import type { ImportTypeDescriptor } from '@/lib/bank-import/types'
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

const props = defineProps<{
  source: ImportSource | null
  importTypes: ImportTypeDescriptor[]
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  updated: []
  error: [message: string]
}>()

const isSaving = ref(false)
const editName = ref('')
const editPreset = ref<string>('')
const editSourceKind = ref<string>('')
const editBankName = ref('')
const editAccountLabel = ref('')
const editAccountIdentifier = ref('')
const editDefaultPlanAssignment = ref<string>('auto_month')
const editIsActive = ref(true)

watch(
  () => props.source,
  (newSource) => {
    if (newSource) {
      editName.value = newSource.name
      editPreset.value = newSource.preset
      editSourceKind.value = newSource.sourceKind
      editBankName.value = newSource.bankName ?? ''
      editAccountLabel.value = newSource.accountLabel ?? ''
      editAccountIdentifier.value = newSource.accountIdentifier ?? ''
      editDefaultPlanAssignment.value = newSource.defaultPlanAssignment
      editIsActive.value = newSource.isActive
    }
  },
  { immediate: true },
)

async function handleSubmit() {
  if (!props.source || !editName.value.trim()) return

  isSaving.value = true

  try {
    const response = await fetch(`/api/import-sources/${props.source.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName.value.trim(),
        preset: editPreset.value,
        sourceKind: editSourceKind.value,
        bankName: editBankName.value.trim() || null,
        accountLabel: editAccountLabel.value.trim() || null,
        accountIdentifier: editAccountIdentifier.value.trim() || null,
        defaultPlanAssignment: editDefaultPlanAssignment.value,
        isActive: editIsActive.value,
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
        : 'Import-Quelle konnte nicht aktualisiert werden.',
    )
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Import-Quelle bearbeiten</DialogTitle>
        <DialogDescription>
          Bearbeite die Einstellungen der Import-Quelle.
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <Label for="edit-name">Name *</Label>
          <Input
            id="edit-name"
            v-model="editName"
            placeholder="z.B. ING Girokonto"
            required
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="edit-preset">Import-Format *</Label>
            <Select v-model="editPreset">
              <SelectTrigger id="edit-preset">
                <SelectValue placeholder="Format wählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="importType in importTypes"
                  :key="importType.preset"
                  :value="importType.preset"
                >
                  {{ importType.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label for="edit-kind">Kontotyp *</Label>
            <Select v-model="editSourceKind">
              <SelectTrigger id="edit-kind">
                <SelectValue placeholder="Typ wählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_account">Bankkonto</SelectItem>
                <SelectItem value="credit_card">Kreditkarte</SelectItem>
                <SelectItem value="other">Sonstige</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="edit-bank">Bank (optional)</Label>
            <Input
              id="edit-bank"
              v-model="editBankName"
              placeholder="z.B. ING"
            />
          </div>
          <div class="space-y-2">
            <Label for="edit-label">Kontobezeichnung (optional)</Label>
            <Input
              id="edit-label"
              v-model="editAccountLabel"
              placeholder="z.B. Gehaltskonto"
            />
          </div>
        </div>

        <div class="space-y-2">
          <Label for="edit-identifier"> Kontonummer / IBAN (optional) </Label>
          <Input
            id="edit-identifier"
            v-model="editAccountIdentifier"
            placeholder="z.B. AT12 3456 7890 1234 5678"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="edit-assignment">Planzuordnung</Label>
            <Select v-model="editDefaultPlanAssignment">
              <SelectTrigger id="edit-assignment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto_month">
                  Automatisch nach Monat
                </SelectItem>
                <SelectItem value="none">Keine</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="flex items-end gap-3 pb-0.5">
            <Switch
              id="edit-active"
              :checked="editIsActive"
              @update:checked="editIsActive = $event"
            />
            <Label for="edit-active">Aktiv</Label>
          </div>
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
