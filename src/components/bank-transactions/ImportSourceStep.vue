<script setup lang="ts">
import { computed } from 'vue'
import type { ImportSource } from '@/lib/bank-transactions'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const selectedSourceId = defineModel<string | null>({ default: null })

const props = defineProps<{
  sources: ImportSource[]
}>()

const activeSources = computed(() =>
  props.sources.filter((source) => source.isActive),
)

const activeFileUploadSources = computed(() =>
  activeSources.value.filter(
    (source) => source.connectionType === 'file_upload',
  ),
)
</script>

<template>
  <div class="space-y-4">
    <div v-if="activeFileUploadSources.length > 0" class="space-y-2">
      <Label>Import-Quelle auswählen</Label>
      <Select v-model="selectedSourceId">
        <SelectTrigger>
          <SelectValue placeholder="Quelle auswählen..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="source in activeFileUploadSources"
            :key="source.id"
            :value="source.id"
          >
            {{ source.name }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div
      v-else-if="sources.length === 0"
      class="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm"
    >
      <p>Keine Import-Quellen vorhanden.</p>
      <p class="mt-1">
        Erstelle eine neue Quelle auf der
        <a href="/import-sources" class="text-primary underline"
          >Verwaltungsseite</a
        >.
      </p>
    </div>

    <div
      v-else-if="activeSources.length === 0"
      class="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm"
    >
      <p>Alle Import-Quellen sind derzeit inaktiv.</p>
      <p class="mt-1">
        Aktiviere mindestens eine Quelle auf der
        <a href="/import-sources" class="text-primary underline"
          >Verwaltungsseite</a
        >.
      </p>
    </div>

    <div
      v-else
      class="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm"
    >
      <p>Keine dateibasierten Import-Quellen verfügbar.</p>
      <p class="mt-1">
        Verbundene Banken werden über die Synchronisierung aktualisiert und
        nicht per Datei-Upload importiert. Erstelle auf der
        <a href="/import-sources" class="text-primary underline"
          >Verwaltungsseite</a
        >
        eine CSV- oder XLSX-Quelle, wenn du Dateien importieren möchtest.
      </p>
    </div>
  </div>
</template>
