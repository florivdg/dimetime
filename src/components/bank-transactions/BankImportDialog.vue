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
} from '@/components/ui/stepper'
import {
  ArrowLeft,
  Check,
  CircleCheck,
  Eye,
  FileUp,
  Landmark,
  Loader2,
  Upload,
} from 'lucide-vue-next'
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

const steps = [
  { number: 1, title: 'Quelle', icon: Landmark },
  { number: 2, title: 'Datei', icon: FileUp },
  { number: 3, title: 'Vorschau', icon: Eye },
  { number: 4, title: 'Ergebnis', icon: CircleCheck },
]

const selectedSource = computed(() =>
  props.sources.find((s) => s.id === selectedSourceId.value),
)

const canGoToStep2 = computed(() => Boolean(selectedSource.value?.isActive))
const canGoToStep3 = computed(() => !!selectedFile.value)

watch(open, async (isOpen) => {
  if (isOpen) {
    resetState()
    await loadImportTypes()
  }
})

watch(selectedSourceId, () => {
  if (currentStep.value === 1 && canGoToStep2.value) {
    currentStep.value = 2
  }
})

watch(selectedFile, (file) => {
  if (file && currentStep.value === 2) {
    goNext()
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
}

function handleStepChange(newStep: number | undefined) {
  if (newStep === undefined || isLoading.value) return

  // Backward navigation (always allowed except from step 4)
  if (newStep < currentStep.value) {
    if (currentStep.value >= 4) return
    if (currentStep.value === 3) {
      previewResult.value = null
      errorMessage.value = null
    }
    currentStep.value = newStep
    return
  }

  // Forward navigation via stepper click
  if (newStep === 2 && currentStep.value === 1 && canGoToStep2.value) {
    currentStep.value = 2
    return
  }
  if (newStep === 3 && currentStep.value === 2 && canGoToStep3.value) {
    runPreview()
    return
  }
  // Step 4 only reachable via commit button — ignore click
}

function goBack() {
  if (currentStep.value > 1 && currentStep.value < 4)
    handleStepChange(currentStep.value - 1)
}

function goNext() {
  handleStepChange(currentStep.value + 1)
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
    currentStep.value = 5
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
    <DialogScrollContent class="sm:max-w-185">
      <DialogHeader>
        <DialogTitle>Kontoauszug importieren</DialogTitle>
        <DialogDescription>
          Importiere Transaktionen aus deinem Bankauszug.
        </DialogDescription>
      </DialogHeader>

      <!-- Stepper -->
      <Stepper
        :model-value="currentStep"
        :linear="false"
        class="mx-auto flex w-full max-w-md items-start gap-2"
        @update:model-value="handleStepChange"
      >
        <StepperItem
          v-for="step in steps"
          :key="step.number"
          v-slot="{ state }"
          class="relative flex w-full flex-col items-center justify-center"
          :step="step.number"
          :disabled="(step.number === 4 && currentStep < 5) || isLoading"
        >
          <StepperSeparator
            v-if="step.number !== steps[steps.length - 1]?.number"
            class="bg-muted group-data-[state=completed]:bg-primary absolute top-5 right-[calc(-50%+10px)] left-[calc(50%+20px)] block h-0.5 shrink-0 rounded-full"
          />

          <StepperTrigger as-child>
            <Button
              :variant="
                state === 'completed' || state === 'active'
                  ? 'default'
                  : 'outline'
              "
              size="icon"
              class="z-10 shrink-0 rounded-full"
              :class="[
                state === 'active' &&
                  'ring-ring ring-offset-background ring-2 ring-offset-2',
              ]"
            >
              <Check v-if="state === 'completed'" class="size-5" />
              <component :is="step.icon" v-else class="size-5" />
            </Button>
          </StepperTrigger>
        </StepperItem>
      </Stepper>

      <!-- Step Content -->
      <div class="min-h-45 overflow-hidden">
        <!-- Step 1: Source -->
        <ImportSourceStep
          v-if="currentStep === 1"
          v-model="selectedSourceId"
          :sources="sources"
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
          v-else-if="currentStep >= 4"
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

        <!-- Commit -->
        <Button v-if="currentStep === 3 && previewResult" @click="runCommit">
          <Upload class="mr-2 size-4" />
          Import bestätigen
        </Button>

        <!-- Close (result step) -->
        <Button v-if="currentStep >= 4 && !isLoading" @click="closeDialog">
          Schließen
        </Button>
      </DialogFooter>
    </DialogScrollContent>
  </Dialog>
</template>
