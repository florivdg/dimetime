<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Category } from '@/lib/categories'
import type { InstallmentPlanWithStats } from '@/lib/installments'
import { mutateJson } from '@/lib/http'
import { currentMonth } from '@/lib/dates'
import { createInstallmentSchema } from '@/lib/installments-schema'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-vue-next'
import AmountInputGroup from '@/components/shared/AmountInputGroup.vue'

const props = defineProps<{
  /** Installment being edited; `null` switches the dialog to create mode. */
  installment: InstallmentPlanWithStats | null
  categories: Category[]
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  saved: [name: string, isNew: boolean]
  error: [message: string]
}>()

const isSaving = ref(false)
const formName = ref('')
const formNote = ref('')
const formAmount = ref(0)
const formFinalAmount = ref<number | null>(null)
const formTotalInstallments = ref(12)
const formPrepaidInstallments = ref(0)
const formStartMonth = ref(currentMonth())
const formDayOfMonth = ref<number | null>(null)
const formCategoryId = ref<string | null>(null)

const isEdit = computed(() => props.installment !== null)

// Ratenzahlungen are always expenses — the toggle stays fixed
const formType = computed<'income' | 'expense'>({
  get: (): 'income' | 'expense' => 'expense',
  set: () => undefined,
})

function resetForm() {
  formName.value = ''
  formNote.value = ''
  formAmount.value = 0
  formFinalAmount.value = null
  formTotalInstallments.value = 12
  formPrepaidInstallments.value = 0
  formStartMonth.value = currentMonth()
  formDayOfMonth.value = null
  formCategoryId.value = null
}

function fillFrom(installment: InstallmentPlanWithStats) {
  formName.value = installment.name
  formNote.value = installment.note ?? ''
  formAmount.value = installment.amount / 100 // Convert cents to euros
  formFinalAmount.value =
    installment.finalAmount === null ? null : installment.finalAmount / 100
  formTotalInstallments.value = installment.totalInstallments
  formPrepaidInstallments.value = installment.prepaidInstallments
  formStartMonth.value = installment.startMonth
  formDayOfMonth.value = installment.dayOfMonth
  formCategoryId.value = installment.categoryId
}

watch(open, (isOpen) => {
  if (!isOpen) return
  if (props.installment) fillFrom(props.installment)
  else resetForm()
})

function buildPayload() {
  return {
    name: formName.value.trim(),
    note: formNote.value.trim() || null,
    amount: Math.round(formAmount.value * 100),
    finalAmount:
      formFinalAmount.value === null
        ? null
        : Math.round(formFinalAmount.value * 100),
    totalInstallments: formTotalInstallments.value,
    prepaidInstallments: formPrepaidInstallments.value,
    startMonth: formStartMonth.value,
    dayOfMonth: formDayOfMonth.value,
    categoryId: formCategoryId.value,
  }
}

/**
 * First rule the payload violates — checked against the very schema the API
 * validates with, so client and server never drift apart. `null` means the
 * form is submittable.
 */
const validationError = computed<string | null>(() => {
  const parsed = createInstallmentSchema.safeParse(buildPayload())
  return parsed.success ? null : parsed.error.issues[0].message
})

async function handleSubmit() {
  if (validationError.value) {
    emit('error', validationError.value)
    return
  }

  const existing = props.installment
  isSaving.value = true
  await mutateJson({
    url: existing ? `/api/installments/${existing.id}` : '/api/installments',
    method: existing ? 'PUT' : 'POST',
    body: buildPayload(),
    notOkMessage: existing
      ? 'Fehler beim Aktualisieren'
      : 'Fehler beim Erstellen',
    fallbackMessage: existing
      ? 'Ratenzahlung konnte nicht aktualisiert werden.'
      : 'Ratenzahlung konnte nicht erstellt werden.',
    onSuccess: () => {
      const name = formName.value.trim()
      open.value = false
      emit('saved', name, existing === null)
    },
    onError: (message) => emit('error', message),
  })
  isSaving.value = false
}

function toNullableNumber(value: string | number): number | null {
  return value === '' || value === undefined ? null : Number(value)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>
          {{ isEdit ? 'Ratenzahlung bearbeiten' : 'Neue Ratenzahlung' }}
        </DialogTitle>
        <DialogDescription>
          {{
            isEdit
              ? 'Bearbeiten Sie die Ratenzahlung. Offene Posten werden in den Plänen aktualisiert.'
              : 'Legen Sie eine Ratenzahlung an. Die Raten werden automatisch in die passenden Pläne übernommen.'
          }}
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <Label for="installment-name">Name</Label>
          <Input
            id="installment-name"
            v-model="formName"
            placeholder="z.B. Waschmaschine"
            required
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>Monatliche Rate</Label>
            <AmountInputGroup
              v-model:amount="formAmount"
              v-model:type="formType"
            />
          </div>

          <div class="space-y-2">
            <Label for="installment-final-amount">Schlussrate (optional)</Label>
            <Input
              id="installment-final-amount"
              :model-value="formFinalAmount ?? undefined"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              @update:model-value="
                (v: string | number) => (formFinalAmount = toNullableNumber(v))
              "
            />
            <p class="text-muted-foreground text-xs">
              Betrag der letzten Rate, falls abweichend
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="installment-total">Anzahl Raten</Label>
            <Input
              id="installment-total"
              v-model.number="formTotalInstallments"
              type="number"
              min="1"
              step="1"
              required
            />
          </div>

          <div class="space-y-2">
            <Label for="installment-prepaid">Davon bereits gezahlt</Label>
            <Input
              id="installment-prepaid"
              v-model.number="formPrepaidInstallments"
              type="number"
              min="0"
              step="1"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="installment-start-month">Startmonat</Label>
            <Input
              id="installment-start-month"
              v-model="formStartMonth"
              type="month"
              required
            />
          </div>

          <div class="space-y-2">
            <Label for="installment-day">Fälligkeitstag (optional)</Label>
            <Input
              id="installment-day"
              :model-value="formDayOfMonth ?? undefined"
              type="number"
              min="1"
              max="31"
              placeholder="z.B. 15"
              @update:model-value="
                (v: string | number) => (formDayOfMonth = toNullableNumber(v))
              "
            />
          </div>
        </div>

        <div class="space-y-2">
          <Label for="installment-category">Kategorie (optional)</Label>
          <Select v-model="formCategoryId">
            <SelectTrigger id="installment-category" class="w-full">
              <SelectValue placeholder="Kategorie wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="null">Keine Kategorie</SelectItem>
              <SelectItem
                v-for="cat in categories"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <Label for="installment-note">Notiz (optional)</Label>
          <Textarea
            id="installment-note"
            v-model="formNote"
            placeholder="Zusätzliche Notizen..."
          />
        </div>

        <p v-if="validationError" class="text-destructive text-sm">
          {{ validationError }}
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            Abbrechen
          </Button>
          <Button
            type="submit"
            :disabled="isSaving || validationError !== null"
          >
            <Loader2 v-if="isSaving" class="size-4 animate-spin" />
            {{ isEdit ? 'Speichern' : 'Erstellen' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
