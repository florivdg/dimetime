<script setup lang="ts">
import { ref, computed } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { FileJson, Check, X, Upload } from 'lucide-vue-next'
import {
  parsePlansJson,
  parseTransactionsJson,
  type ImportedPlanRaw,
  type ImportedTransactionRaw,
} from '@/lib/import'

const emit = defineEmits<{
  parsed: [plans: ImportedPlanRaw[], transactions: ImportedTransactionRaw[]]
}>()

// File data
const plansFile = ref<File | null>(null)
const transactionsFile = ref<File | null>(null)

// Parsed data
const parsedPlans = ref<ImportedPlanRaw[] | null>(null)
const parsedTransactions = ref<ImportedTransactionRaw[] | null>(null)

// Validation state
const plansError = ref<string | null>(null)
const transactionsError = ref<string | null>(null)

// File inputs
const plansInput = ref<HTMLInputElement>()
const transactionsInput = ref<HTMLInputElement>()

const canProceed = computed(() => {
  return (
    parsedPlans.value !== null &&
    parsedTransactions.value !== null &&
    plansError.value === null &&
    transactionsError.value === null
  )
})

async function handlePlansFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  plansFile.value = file
  plansError.value = null
  parsedPlans.value = null

  try {
    const content = await file.text()
    parsedPlans.value = parsePlansJson(content)
    checkAndEmit()
  } catch (error) {
    plansError.value =
      error instanceof Error
        ? error.message
        : 'Datei konnte nicht gelesen werden'
    parsedPlans.value = null
  }
}

async function handleTransactionsFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  transactionsFile.value = file
  transactionsError.value = null
  parsedTransactions.value = null

  try {
    const content = await file.text()
    parsedTransactions.value = parseTransactionsJson(content)
    checkAndEmit()
  } catch (error) {
    transactionsError.value =
      error instanceof Error
        ? error.message
        : 'Datei konnte nicht gelesen werden'
    parsedTransactions.value = null
  }
}

function checkAndEmit() {
  if (parsedPlans.value && parsedTransactions.value) {
    emit('parsed', parsedPlans.value, parsedTransactions.value)
  }
}

function clearPlans() {
  plansFile.value = null
  parsedPlans.value = null
  plansError.value = null
  if (plansInput.value) {
    plansInput.value.value = ''
  }
}

function clearTransactions() {
  transactionsFile.value = null
  parsedTransactions.value = null
  transactionsError.value = null
  if (transactionsInput.value) {
    transactionsInput.value.value = ''
  }
}
</script>

<template>
  <div class="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Dateien hochladen</CardTitle>
        <CardDescription>
          Lade die JSON-Dateien mit den Plänen und Transaktionen hoch.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-6">
        <!-- Plans Upload -->
        <div class="space-y-2">
          <Label>Pläne (plans_rows.json)</Label>
          <div
            class="border-muted hover:border-primary/50 relative flex items-center gap-4 rounded-lg border-2 border-dashed p-4 transition-colors"
            :class="{
              'border-lime-500 bg-lime-500/5': parsedPlans && !plansError,
              'border-destructive bg-destructive/5': plansError,
            }"
          >
            <div
              class="bg-muted flex size-12 shrink-0 items-center justify-center rounded-lg"
            >
              <FileJson
                v-if="!parsedPlans && !plansError"
                class="text-muted-foreground size-6"
              />
              <Check
                v-else-if="parsedPlans && !plansError"
                class="size-6 text-lime-500"
              />
              <X v-else class="text-destructive size-6" />
            </div>
            <div class="flex-1">
              <template v-if="plansFile">
                <p class="font-medium">{{ plansFile.name }}</p>
                <p v-if="parsedPlans" class="text-muted-foreground text-sm">
                  {{ parsedPlans.length }} Pläne gefunden
                </p>
                <p v-if="plansError" class="text-destructive text-sm">
                  {{ plansError }}
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
                v-if="plansFile"
                type="button"
                variant="ghost"
                size="sm"
                @click.stop="clearPlans"
              >
                Entfernen
              </Button>
              <Button
                v-else
                type="button"
                variant="outline"
                size="sm"
                @click="plansInput?.click()"
              >
                <Upload class="mr-2 size-4" />
                Auswählen
              </Button>
            </div>
            <input
              v-if="!plansFile"
              ref="plansInput"
              type="file"
              accept=".json,application/json"
              class="absolute inset-0 cursor-pointer opacity-0"
              @change="handlePlansFile"
            />
          </div>
        </div>

        <!-- Transactions Upload -->
        <div class="space-y-2">
          <Label>Transaktionen (planned_transactions_rows.json)</Label>
          <div
            class="border-muted hover:border-primary/50 relative flex items-center gap-4 rounded-lg border-2 border-dashed p-4 transition-colors"
            :class="{
              'border-lime-500 bg-lime-500/5':
                parsedTransactions && !transactionsError,
              'border-destructive bg-destructive/5': transactionsError,
            }"
          >
            <div
              class="bg-muted flex size-12 shrink-0 items-center justify-center rounded-lg"
            >
              <FileJson
                v-if="!parsedTransactions && !transactionsError"
                class="text-muted-foreground size-6"
              />
              <Check
                v-else-if="parsedTransactions && !transactionsError"
                class="size-6 text-lime-500"
              />
              <X v-else class="text-destructive size-6" />
            </div>
            <div class="flex-1">
              <template v-if="transactionsFile">
                <p class="font-medium">{{ transactionsFile.name }}</p>
                <p
                  v-if="parsedTransactions"
                  class="text-muted-foreground text-sm"
                >
                  {{ parsedTransactions.length }} Transaktionen gefunden
                </p>
                <p v-if="transactionsError" class="text-destructive text-sm">
                  {{ transactionsError }}
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
                v-if="transactionsFile"
                type="button"
                variant="ghost"
                size="sm"
                @click.stop="clearTransactions"
              >
                Entfernen
              </Button>
              <Button
                v-else
                type="button"
                variant="outline"
                size="sm"
                @click="transactionsInput?.click()"
              >
                <Upload class="mr-2 size-4" />
                Auswählen
              </Button>
            </div>
            <input
              v-if="!transactionsFile"
              ref="transactionsInput"
              type="file"
              accept=".json,application/json"
              class="absolute inset-0 cursor-pointer opacity-0"
              @change="handleTransactionsFile"
            />
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Summary Preview -->
    <Card v-if="canProceed">
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Check class="size-5 text-lime-500" />
          Dateien bereit
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl class="text-muted-foreground grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt class="font-medium">Pläne</dt>
            <dd>{{ parsedPlans?.length ?? 0 }}</dd>
          </div>
          <div>
            <dt class="font-medium">Transaktionen</dt>
            <dd>{{ parsedTransactions?.length ?? 0 }}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  </div>
</template>
