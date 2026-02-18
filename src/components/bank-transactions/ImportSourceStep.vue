<script setup lang="ts">
import type { ImportSource } from '@/lib/bank-transactions'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

defineProps<{
  sources: ImportSource[]
}>()

const selectedSourceId = defineModel<string | null>({ default: null })
</script>

<template>
  <div class="space-y-4">
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

    <div
      v-else
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
  </div>
</template>
