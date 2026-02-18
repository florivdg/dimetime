<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ImportSource } from '@/lib/bank-transactions'
import type { ImportTypeDescriptor } from '@/lib/bank-import/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const props = defineProps<{
  sources: ImportSource[]
  importTypes: ImportTypeDescriptor[]
}>()

const selectedSourceId = defineModel<string | null>({ default: null })

const emit = defineEmits<{
  sourceCreated: [source: ImportSource]
}>()

const showCreateForm = ref(props.sources.length === 0)
const isCreating = ref(false)

// Create form fields
const newName = ref('')
const newPreset = ref<string>('')
const newSourceKind = ref<string>('')
const newBankName = ref('')
const newAccountLabel = ref('')

const canCreate = computed(
  () =>
    newName.value.trim().length > 0 && newPreset.value && newSourceKind.value,
)

function toggleCreateForm() {
  showCreateForm.value = !showCreateForm.value
}

function resetCreateForm() {
  newName.value = ''
  newPreset.value = ''
  newSourceKind.value = ''
  newBankName.value = ''
  newAccountLabel.value = ''
  showCreateForm.value = false
}

async function createSource() {
  if (!canCreate.value) return
  isCreating.value = true
  try {
    const response = await fetch('/api/import-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.value.trim(),
        preset: newPreset.value,
        sourceKind: newSourceKind.value,
        bankName: newBankName.value.trim() || null,
        accountLabel: newAccountLabel.value.trim() || null,
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Quelle konnte nicht erstellt werden')
    }

    const source = (await response.json()) as ImportSource
    selectedSourceId.value = source.id
    emit('sourceCreated', source)
    resetCreateForm()
    toast.success('Import-Quelle erstellt')
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : 'Quelle konnte nicht erstellt werden',
    )
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Source selection -->
    <div v-if="sources.length > 0" class="space-y-2">
      <Label>Import-Quelle auswählen</Label>
      <Select v-model="selectedSourceId">
        <SelectTrigger>
          <SelectValue placeholder="Quelle auswählen..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="source in sources.filter((s) => s.isActive)"
            :key="source.id"
            :value="source.id"
          >
            {{ source.name }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Toggle create form -->
    <div v-if="sources.length > 0 && !showCreateForm">
      <Button variant="outline" size="sm" @click="toggleCreateForm">
        <Plus class="mr-2 size-4" />
        Neue Quelle erstellen
      </Button>
    </div>

    <!-- Create form -->
    <div
      v-if="showCreateForm"
      class="bg-muted/50 space-y-4 rounded-lg border p-4"
    >
      <p class="text-sm font-medium">Neue Import-Quelle erstellen</p>

      <div class="space-y-2">
        <Label>Name *</Label>
        <Input v-model="newName" placeholder="z.B. ING Girokonto" />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <Label>Import-Format *</Label>
          <Select v-model="newPreset">
            <SelectTrigger>
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
          <Label>Kontotyp *</Label>
          <Select v-model="newSourceKind">
            <SelectTrigger>
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
          <Label>Bank (optional)</Label>
          <Input v-model="newBankName" placeholder="z.B. ING" />
        </div>
        <div class="space-y-2">
          <Label>Kontobezeichnung (optional)</Label>
          <Input v-model="newAccountLabel" placeholder="z.B. Gehaltskonto" />
        </div>
      </div>

      <div class="flex gap-2">
        <Button
          :disabled="!canCreate || isCreating"
          size="sm"
          @click="createSource"
        >
          Erstellen
        </Button>
        <Button
          v-if="sources.length > 0"
          variant="ghost"
          size="sm"
          @click="resetCreateForm"
        >
          Abbrechen
        </Button>
      </div>
    </div>
  </div>
</template>
