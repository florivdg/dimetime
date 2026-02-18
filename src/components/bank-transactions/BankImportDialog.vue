<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ImportSource } from '@/lib/bank-transactions'
import type { ImportTypeDescriptor } from '@/lib/bank-import/types'
import type {
  BankImportPreviewResult,
  BankImportCommitResult,
} from '@/lib/bank-import/service'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogScrollContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Stepper,
  StepperItem,
  StepperSeparator,
  StepperTrigger,
  StepperIndicator,
  StepperTitle,
} from '@/components/ui/stepper'
import { ArrowLeft, Check, Loader2, Upload } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import ImportSourceStep from './ImportSourceStep.vue'
import ImportFileStep from './ImportFileStep.vue'
import ImportPreviewStep from './ImportPreviewStep.vue'
import ImportResultStep from './ImportResultStep.vue'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  sources: ImportSource[]
}>()

const emit = defineEmits<{
  imported: []
  sourceCreated: [source: ImportSource]
}>()

// State
const currentStep = ref(1)
const selectedSourceId = ref<string | null>(null)
const selectedFile = ref<File | null>(null)
const previewResult = ref<BankImportPreviewResult | null>(null)
const commitResult = ref<BankImportCommitResult | null>(null)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const importTypes = ref<ImportTypeDescriptor[]>([])
const localSources = ref<ImportSource[]>([...props.sources])

// Watch for external sources changes
watch(
  () => props.sources,
  (newSources) => {
    localSources.value = [...newSources]
  },
)

const steps = [
  { number: 1, title: 'Quelle' },
  { number: 2, title: 'Datei' },
  { number: 3, title: 'Vorschau' },
  { number: 4, title: 'Ergebnis' },
]

const selectedSource = computed(() =>
  localSources.value.find((s) => s.id === selectedSourceId.value),
)

const canGoToStep2 = computed(() => !!selectedSourceId.value)
const canGoToStep3 = computed(() => !!selectedFile.value)

// Load import types when dialog opens
watch(open, async (isOpen) => {
  if (isOpen) {
    resetState()
    await loadImportTypes()
  }
})

async function loadImportTypes() {
  try {
    const response = await fetch('/api/import-types')
    if (!response.ok) throw new Error('Fehler beim Laden der Import-Typen')
    const data = await response.json()
    importTypes.value = data.importTypes
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : 'Import-Typen konnten nicht geladen werden',
    )
  }
}

function resetState() {
  currentStep.value = 1
  selectedSourceId.value = null
  selectedFile.value = null
  previewResult.value = null
  commitResult.value = null
  isLoading.value = false
  errorMessage.value = null
  localSources.value = [...props.sources]
}

function handleSourceCreated(source: ImportSource) {
  localSources.value = [source, ...localSources.value]
  emit('sourceCreated', source)
}

function goBack() {
  if (currentStep.value === 2) {
    currentStep.value = 1
  } else if (currentStep.value === 3) {
    currentStep.value = 2
    previewResult.value = null
    errorMessage.value = null
  }
}

function goNext() {
  if (currentStep.value === 1 && canGoToStep2.value) {
    currentStep.value = 2
  } else if (currentStep.value === 2 && canGoToStep3.value) {
    runPreview()
  }
}

async function postImportForm(
  url: string,
  sourceId: string,
  file: File,
): Promise<unknown> {
  const formData = new FormData()
  formData.append('sourceId', sourceId)
  formData.append('file', file)
  const response = await fetch(url, { method: 'POST', body: formData })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Import fehlgeschlagen')
  return data
}

async function runPreview() {
  if (!selectedSourceId.value || !selectedFile.value) return

  currentStep.value = 3
  isLoading.value = true
  errorMessage.value = null
  previewResult.value = null

  try {
    const data = await postImportForm(
      '/api/bank-imports/preview',
      selectedSourceId.value,
      selectedFile.value,
    )
    previewResult.value = data as BankImportPreviewResult
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Unbekannter Fehler'
    currentStep.value = 2
    toast.error(errorMessage.value)
  } finally {
    isLoading.value = false
  }
}

async function runCommit() {
  if (!selectedSourceId.value || !selectedFile.value) return

  currentStep.value = 4
  isLoading.value = true
  errorMessage.value = null
  commitResult.value = null

  try {
    const data = (await postImportForm(
      '/api/bank-imports/commit',
      selectedSourceId.value,
      selectedFile.value,
    )) as BankImportCommitResult
    commitResult.value = data
    toast.success(
      `Import erfolgreich: ${data.inserted} eingefügt, ${data.updated} aktualisiert`,
    )
    emit('imported')
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Unbekannter Fehler beim Import'
    toast.error(errorMessage.value)
  } finally {
    isLoading.value = false
  }
}

function closeDialog() {
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogScrollContent class="sm:max-w-[740px]">
      <DialogHeader>
        <DialogTitle>Kontoauszug importieren</DialogTitle>
        <DialogDescription>
          Importiere Transaktionen aus deinem Bankauszug.
        </DialogDescription>
      </DialogHeader>

      <!-- Stepper -->
      <Stepper
        v-model="currentStep"
        class="mx-auto flex w-full max-w-md justify-center"
      >
        <StepperItem
          v-for="(step, index) in steps"
          :key="step.number"
          v-slot="{ state }"
          :step="step.number"
          :disabled="true"
          class="flex flex-1 flex-col items-center"
        >
          <StepperTrigger class="flex flex-col items-center gap-1" as="div">
            <StepperIndicator
              class="size-8 rounded-full border-2 text-xs transition-colors"
              :class="{
                'border-lime-500 bg-lime-500 text-white': state === 'active',
                'border-lime-500 bg-lime-500/20 text-lime-600 dark:text-lime-400':
                  state === 'completed',
                'border-muted bg-muted text-muted-foreground':
                  state === 'inactive',
              }"
            >
              <Check v-if="state === 'completed'" class="size-4" />
              <span v-else>{{ step.number }}</span>
            </StepperIndicator>
            <StepperTitle
              class="text-xs font-medium"
              :class="{
                'text-foreground': state === 'active',
                'text-lime-600 dark:text-lime-400': state === 'completed',
                'text-muted-foreground': state === 'inactive',
              }"
            >
              {{ step.title }}
            </StepperTitle>
          </StepperTrigger>
          <StepperSeparator
            v-if="index < steps.length - 1"
            class="mt-1.5 h-0.5 flex-1"
            :class="{
              'bg-lime-500': state === 'completed',
              'bg-muted': state !== 'completed',
            }"
          />
        </StepperItem>
      </Stepper>

      <!-- Step Content -->
      <div class="min-h-[180px]">
        <!-- Step 1: Source -->
        <ImportSourceStep
          v-if="currentStep === 1"
          v-model="selectedSourceId"
          :sources="localSources"
          :import-types="importTypes"
          @source-created="handleSourceCreated"
        />

        <!-- Step 2: File -->
        <ImportFileStep
          v-else-if="currentStep === 2 && selectedSource"
          v-model="selectedFile"
          :selected-source="selectedSource"
          :import-types="importTypes"
        />

        <!-- Step 3: Preview -->
        <div v-else-if="currentStep === 3">
          <div v-if="isLoading" class="flex items-center justify-center py-8">
            <Loader2 class="text-muted-foreground size-6 animate-spin" />
            <span class="text-muted-foreground ml-2"
              >Vorschau wird erstellt...</span
            >
          </div>
          <ImportPreviewStep
            v-else-if="previewResult"
            :preview="previewResult"
          />
        </div>

        <!-- Step 4: Result -->
        <ImportResultStep
          v-else-if="currentStep === 4"
          :result="commitResult"
          :is-loading="isLoading"
          :error="errorMessage"
        />
      </div>

      <DialogFooter class="border-t pt-4">
        <!-- Cancel / Back -->
        <Button
          v-if="currentStep < 4"
          variant="outline"
          @click="currentStep === 1 ? closeDialog() : goBack()"
        >
          <ArrowLeft v-if="currentStep > 1" class="mr-2 size-4" />
          {{ currentStep === 1 ? 'Abbrechen' : 'Zurück' }}
        </Button>

        <!-- Next / Preview / Commit -->
        <Button
          v-if="currentStep === 1"
          :disabled="!canGoToStep2"
          @click="goNext"
        >
          Weiter
        </Button>
        <Button
          v-else-if="currentStep === 2"
          :disabled="!canGoToStep3"
          @click="goNext"
        >
          Vorschau
        </Button>
        <Button
          v-else-if="currentStep === 3 && previewResult"
          @click="runCommit"
        >
          <Upload class="mr-2 size-4" />
          Import bestätigen
        </Button>

        <!-- Close (result step) -->
        <Button v-if="currentStep === 4 && !isLoading" @click="closeDialog">
          Schließen
        </Button>
      </DialogFooter>
    </DialogScrollContent>
  </Dialog>
</template>
