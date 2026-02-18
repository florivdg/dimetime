<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ImportSource } from '@/lib/bank-transactions'
import type { ImportTypeDescriptor } from '@/lib/bank-import/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Check, Upload, X } from 'lucide-vue-next'

const props = defineProps<{
  selectedSource: ImportSource
  importTypes: ImportTypeDescriptor[]
}>()

const file = defineModel<File | null>({ default: null })

const fileInput = ref<HTMLInputElement>()

const descriptor = computed(() =>
  props.importTypes.find((t) => t.preset === props.selectedSource.preset),
)

const acceptFilter = computed(() => {
  if (!descriptor.value) return ''
  return descriptor.value.extensions.join(',')
})

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const selected = input.files?.[0]
  if (selected) {
    file.value = selected
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  const dropped = event.dataTransfer?.files?.[0]
  if (dropped) {
    file.value = dropped
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
}

function clearFile() {
  file.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="space-y-2">
      <Label>
        Datei für
        <span class="font-semibold">{{ selectedSource.name }}</span>
      </Label>
      <p v-if="descriptor" class="text-muted-foreground text-sm">
        Erwartetes Format: {{ descriptor.name }} ({{
          descriptor.extensions.join(', ')
        }})
      </p>
    </div>

    <div
      class="border-muted hover:border-primary/50 relative flex items-center gap-4 rounded-lg border-2 border-dashed p-6 transition-colors"
      :class="{
        'border-lime-500 bg-lime-500/5': file,
      }"
      @drop="handleDrop"
      @dragover="handleDragOver"
    >
      <div
        class="bg-muted flex size-12 shrink-0 items-center justify-center rounded-lg"
      >
        <Check v-if="file" class="size-6 text-lime-500" />
        <Upload v-else class="text-muted-foreground size-6" />
      </div>
      <div class="min-w-0 flex-1">
        <template v-if="file">
          <p class="truncate font-medium">{{ file.name }}</p>
          <p class="text-muted-foreground text-sm">
            {{ (file.size / 1024).toFixed(1) }} KB
          </p>
        </template>
        <template v-else>
          <p class="text-muted-foreground">
            Klicken zum Auswählen oder hierher ziehen
          </p>
        </template>
      </div>
      <div class="flex gap-2">
        <Button
          v-if="file"
          type="button"
          variant="ghost"
          size="sm"
          @click.stop="clearFile"
        >
          <X class="mr-1 size-4" />
          Entfernen
        </Button>
        <Button
          v-else
          type="button"
          variant="outline"
          size="sm"
          @click="fileInput?.click()"
        >
          <Upload class="mr-2 size-4" />
          Auswählen
        </Button>
      </div>
      <input
        v-if="!file"
        ref="fileInput"
        type="file"
        :accept="acceptFilter"
        class="absolute inset-0 cursor-pointer opacity-0"
        @change="handleFileChange"
      />
    </div>
  </div>
</template>
