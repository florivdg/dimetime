<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ImportTypeDescriptor } from '@/lib/bank-import/types'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Loader2, Plus } from 'lucide-vue-next'

const props = defineProps<{
  importTypes: ImportTypeDescriptor[]
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  created: []
  error: [message: string]
}>()

const isCreating = ref(false)
const name = ref('')
const preset = ref<string>('')
const sourceKind = ref<string>('')
const bankName = ref('')
const accountLabel = ref('')
const accountIdentifier = ref('')
const defaultPlanAssignment = ref<string>('auto_month')
const isActive = ref(true)

const canSubmit = computed(
  () => name.value.trim().length > 0 && preset.value && sourceKind.value,
)

function resetForm() {
  name.value = ''
  preset.value = ''
  sourceKind.value = ''
  bankName.value = ''
  accountLabel.value = ''
  accountIdentifier.value = ''
  defaultPlanAssignment.value = 'auto_month'
  isActive.value = true
}

async function handleSubmit() {
  if (!canSubmit.value) return

  isCreating.value = true

  try {
    const response = await fetch('/api/import-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.value.trim(),
        preset: preset.value,
        sourceKind: sourceKind.value,
        bankName: bankName.value.trim() || null,
        accountLabel: accountLabel.value.trim() || null,
        accountIdentifier: accountIdentifier.value.trim() || null,
        defaultPlanAssignment: defaultPlanAssignment.value,
        isActive: isActive.value,
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
        : 'Import-Quelle konnte nicht erstellt werden.',
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
        Neue Import-Quelle
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Neue Import-Quelle erstellen</DialogTitle>
        <DialogDescription>
          Erstelle eine neue Quelle für den Import von Kontoauszügen.
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <Label for="create-name">Name *</Label>
          <Input
            id="create-name"
            v-model="name"
            placeholder="z.B. ING Girokonto"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="create-preset">Import-Format *</Label>
            <Select v-model="preset">
              <SelectTrigger id="create-preset">
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
            <Label for="create-kind">Kontotyp *</Label>
            <Select v-model="sourceKind">
              <SelectTrigger id="create-kind">
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
            <Label for="create-bank">Bank (optional)</Label>
            <Input id="create-bank" v-model="bankName" placeholder="z.B. ING" />
          </div>
          <div class="space-y-2">
            <Label for="create-label">Kontobezeichnung (optional)</Label>
            <Input
              id="create-label"
              v-model="accountLabel"
              placeholder="z.B. Gehaltskonto"
            />
          </div>
        </div>

        <div class="space-y-2">
          <Label for="create-identifier"> Kontonummer / IBAN (optional) </Label>
          <Input
            id="create-identifier"
            v-model="accountIdentifier"
            placeholder="z.B. AT12 3456 7890 1234 5678"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="create-assignment">Planzuordnung</Label>
            <Select v-model="defaultPlanAssignment">
              <SelectTrigger id="create-assignment">
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
              id="create-active"
              :checked="isActive"
              @update:checked="isActive = $event"
            />
            <Label for="create-active">Aktiv</Label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            Abbrechen
          </Button>
          <Button type="submit" :disabled="isCreating || !canSubmit">
            <Loader2 v-if="isCreating" class="size-4 animate-spin" />
            Erstellen
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
