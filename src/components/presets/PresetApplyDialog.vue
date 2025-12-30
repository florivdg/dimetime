<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Plan } from '@/lib/plans'
import type { PresetWithTags } from '@/lib/presets'
import { formatAmount, getPlanDisplayName } from '@/lib/format'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const props = defineProps<{
  preset: PresetWithTags | null
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  applied: []
  error: [message: string]
}>()

const isApplying = ref(false)
const isLoadingPlans = ref(false)
const selectedPlanId = ref<string | null>(null)
const customDueDate = ref('')
const plans = ref<Plan[]>([])

// Filter out archived plans
const availablePlans = computed(() => {
  return plans.value.filter((p) => !p.isArchived)
})

// Load plans when dialog opens
watch(open, async (isOpen) => {
  if (isOpen) {
    selectedPlanId.value = null
    customDueDate.value = ''
    await loadPlans()
  }
})

async function loadPlans() {
  isLoadingPlans.value = true
  try {
    const response = await fetch('/api/plans')
    if (!response.ok) {
      throw new Error('Fehler beim Laden der Pläne')
    }
    const data = await response.json()
    plans.value = data.plans || []
  } catch (error) {
    emit(
      'error',
      error instanceof Error
        ? error.message
        : 'Pläne konnten nicht geladen werden.',
    )
  } finally {
    isLoadingPlans.value = false
  }
}

async function handleSubmit() {
  if (!props.preset || !selectedPlanId.value) return

  isApplying.value = true

  try {
    const response = await fetch(`/api/presets/${props.preset.id}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: selectedPlanId.value,
        dueDate: customDueDate.value || undefined,
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Fehler beim Anwenden')
    }

    open.value = false
    emit('applied')

    // Find plan name for toast
    const selectedPlan = plans.value.find((p) => p.id === selectedPlanId.value)
    const planName = selectedPlan
      ? getPlanDisplayName(selectedPlan.name, selectedPlan.date)
      : 'Plan'

    // Show success toast with link to plan
    toast.success(`Vorlage zu "${planName}" hinzugefügt`, {
      action: {
        label: 'Plan öffnen',
        onClick: () => {
          window.location.href = `/plans/${selectedPlanId.value}`
        },
      },
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Vorlage konnte nicht angewendet werden.'
    emit('error', message)
    toast.error(message)
  } finally {
    isApplying.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Vorlage anwenden</DialogTitle>
        <DialogDescription>
          Wählen Sie einen Plan, um eine Transaktion aus dieser Vorlage zu
          erstellen.
        </DialogDescription>
      </DialogHeader>

      <div v-if="isLoadingPlans" class="flex items-center justify-center py-8">
        <Loader2 class="text-muted-foreground size-6 animate-spin" />
      </div>

      <form v-else class="space-y-4" @submit.prevent="handleSubmit">
        <div v-if="preset" class="bg-muted space-y-1 rounded-md p-3">
          <div class="text-sm font-medium">{{ preset.name }}</div>
          <div class="text-muted-foreground text-sm">
            {{ formatAmount(preset.amount) }}
            <span v-if="preset.categoryName" class="ml-2">
              • {{ preset.categoryName }}
            </span>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="plan-select">Plan</Label>
          <Select v-model="selectedPlanId" required>
            <SelectTrigger id="plan-select">
              <SelectValue placeholder="Plan wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="plan in availablePlans"
                :key="plan.id"
                :value="plan.id"
              >
                {{ getPlanDisplayName(plan.name, plan.date) }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p
            v-if="availablePlans.length === 0"
            class="text-muted-foreground text-sm"
          >
            Keine aktiven Pläne verfügbar
          </p>
        </div>

        <div class="space-y-2">
          <Label for="due-date">Fälligkeitsdatum (optional)</Label>
          <Input
            id="due-date"
            v-model="customDueDate"
            type="date"
            placeholder="Verwendet Plan-Datum"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            Abbrechen
          </Button>
          <Button
            type="submit"
            :disabled="
              isApplying || !selectedPlanId || availablePlans.length === 0
            "
          >
            <Loader2 v-if="isApplying" class="size-4 animate-spin" />
            Anwenden
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
