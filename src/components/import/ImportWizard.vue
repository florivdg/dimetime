<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  Stepper,
  StepperItem,
  StepperSeparator,
  StepperTrigger,
  StepperIndicator,
  StepperTitle,
} from '@/components/ui/stepper'
import { ArrowLeft, ArrowRight, Upload, Loader2, Check } from 'lucide-vue-next'
import FileUploadStep from './FileUploadStep.vue'
import UserMappingStep from './UserMappingStep.vue'
import ImportResultStep from './ImportResultStep.vue'
import {
  getImportSummary,
  transformPlans,
  transformTransactions,
  validatePlanReferences,
  validateUserMapping,
  type ImportedPlanRaw,
  type ImportedTransactionRaw,
  type ImportSummary,
  type UserMapping,
  type ImportResult,
} from '@/lib/import'
import type { UserBasic } from '@/lib/users'

// Step management
const currentStep = ref<1 | 2 | 3>(1)

// Parsed file data
const parsedPlans = ref<ImportedPlanRaw[]>([])
const parsedTransactions = ref<ImportedTransactionRaw[]>([])

// Summary
const summary = ref<ImportSummary | null>(null)

// System users
const systemUsers = ref<UserBasic[]>([])
const usersLoading = ref(false)

// User mapping
const userMapping = ref<UserMapping>({})

// Import state
const isImporting = ref(false)
const importResult = ref<ImportResult | null>(null)
const importError = ref<string | null>(null)

// Computed: can proceed to next step
const canProceedToStep2 = computed(() => {
  return parsedPlans.value.length > 0 && parsedTransactions.value.length > 0
})

const canProceedToStep3 = computed(() => {
  if (!summary.value) return false
  return summary.value.uniqueImportedUserIds.every(
    (id) => userMapping.value[id],
  )
})

// Steps configuration
const steps = [
  { number: 1, title: 'Dateien' },
  { number: 2, title: 'Benutzer' },
  { number: 3, title: 'Import' },
]

// Load users on mount
onMounted(async () => {
  await loadUsers()
})

async function loadUsers() {
  usersLoading.value = true
  try {
    const response = await fetch('/api/users')
    if (!response.ok) throw new Error('Benutzer konnten nicht geladen werden')
    const data = await response.json()
    systemUsers.value = data.users
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : 'Benutzer konnten nicht geladen werden',
    )
  } finally {
    usersLoading.value = false
  }
}

function handleFilesParsed(
  plans: ImportedPlanRaw[],
  transactions: ImportedTransactionRaw[],
) {
  parsedPlans.value = plans
  parsedTransactions.value = transactions
  summary.value = getImportSummary(plans, transactions)

  // Validate plan references
  const planValidation = validatePlanReferences(plans, transactions)
  if (!planValidation.valid) {
    toast.warning(
      `${planValidation.missingPlanIds.length} Transaktionen verweisen auf nicht existierende Pläne`,
    )
  }
}

function goToStep(step: 1 | 2 | 3) {
  if (step === 2 && !canProceedToStep2.value) return
  if (step === 3 && !canProceedToStep3.value) return
  currentStep.value = step
}

function nextStep() {
  if (currentStep.value === 1 && canProceedToStep2.value) {
    currentStep.value = 2
  } else if (currentStep.value === 2 && canProceedToStep3.value) {
    startImport()
  }
}

function prevStep() {
  if (currentStep.value === 2) {
    currentStep.value = 1
  }
}

async function startImport() {
  currentStep.value = 3
  isImporting.value = true
  importError.value = null
  importResult.value = null

  try {
    // Validate user mapping
    const userValidation = validateUserMapping(
      parsedTransactions.value,
      userMapping.value,
    )
    if (!userValidation.valid) {
      throw new Error(
        `Nicht alle Benutzer sind zugeordnet: ${userValidation.unmappedUserIds.join(', ')}`,
      )
    }

    // Transform data
    const transformedPlans = transformPlans(parsedPlans.value)
    const transformedTransactions = transformTransactions(
      parsedTransactions.value,
      userMapping.value,
    )

    // Send to API
    const response = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plans: transformedPlans,
        transactions: transformedTransactions,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Import fehlgeschlagen')
    }

    importResult.value = data
    toast.success(
      `Import erfolgreich: ${data.plansImported} Pläne, ${data.transactionsImported} Transaktionen`,
    )
  } catch (error) {
    importError.value =
      error instanceof Error ? error.message : 'Unbekannter Fehler beim Import'
    toast.error(importError.value)
  } finally {
    isImporting.value = false
  }
}

function resetWizard() {
  currentStep.value = 1
  parsedPlans.value = []
  parsedTransactions.value = []
  summary.value = null
  userMapping.value = {}
  importResult.value = null
  importError.value = null
}
</script>

<template>
  <div class="space-y-6">
    <!-- Step Indicator -->
    <Stepper
      v-model="currentStep"
      class="mx-auto flex w-full max-w-md justify-center"
    >
      <StepperItem
        v-for="(step, index) in steps"
        :key="step.number"
        v-slot="{ state }"
        :step="step.number"
        :disabled="
          (step.number === 2 && !canProceedToStep2) ||
          (step.number === 3 && !canProceedToStep3)
        "
        class="flex flex-1 flex-col items-center"
      >
        <StepperTrigger class="flex flex-col items-center gap-1">
          <StepperIndicator
            class="size-10 rounded-full border-2 transition-colors"
            :class="{
              'border-lime-500 bg-lime-500 text-white': state === 'active',
              'border-lime-500 bg-lime-500/20 text-lime-600 dark:text-lime-400':
                state === 'completed',
              'border-muted bg-muted text-muted-foreground':
                state === 'inactive',
            }"
          >
            <Check v-if="state === 'completed'" class="size-5" />
            <span v-else>{{ step.number }}</span>
          </StepperIndicator>
          <StepperTitle
            class="text-sm font-medium"
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
          class="mt-2 h-0.5 flex-1"
          :class="{
            'bg-lime-500': state === 'completed',
            'bg-muted': state !== 'completed',
          }"
        />
      </StepperItem>
    </Stepper>

    <!-- Step Content -->
    <div v-if="currentStep === 1">
      <FileUploadStep @parsed="handleFilesParsed" />
    </div>

    <div v-else-if="currentStep === 2 && summary">
      <UserMappingStep
        :summary="summary"
        :system-users="systemUsers"
        v-model="userMapping"
      />
    </div>

    <div v-else-if="currentStep === 3">
      <ImportResultStep
        :result="importResult"
        :is-loading="isImporting"
        :error="importError"
        @reset="resetWizard"
      />
    </div>

    <!-- Navigation Buttons -->
    <div
      v-if="currentStep !== 3"
      class="flex items-center justify-between border-t pt-4"
    >
      <Button v-if="currentStep > 1" variant="outline" @click="prevStep">
        <ArrowLeft class="mr-2 size-4" />
        Zurück
      </Button>
      <div v-else />

      <Button
        v-if="currentStep === 1"
        :disabled="!canProceedToStep2"
        @click="nextStep"
      >
        Weiter
        <ArrowRight class="ml-2 size-4" />
      </Button>

      <Button
        v-else-if="currentStep === 2"
        :disabled="!canProceedToStep3 || isImporting"
        @click="nextStep"
      >
        <Loader2 v-if="isImporting" class="mr-2 size-4 animate-spin" />
        <Upload v-else class="mr-2 size-4" />
        Import starten
      </Button>
    </div>
  </div>
</template>
