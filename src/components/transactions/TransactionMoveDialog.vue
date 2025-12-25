<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { TransactionWithCategory } from '@/lib/transactions'
import type { Plan } from '@/lib/plans'
import { getPlanDisplayName } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  transaction: TransactionWithCategory | null
  currentPlanId: string
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  moved: [targetPlanId: string, targetPlanName: string]
  error: [message: string]
}>()

const isMoving = ref(false)
const isLoadingPlans = ref(false)
const availablePlans = ref<Plan[]>([])
const selectedPlanId = ref<string | null>(null)

// Filter out current plan and archived plans
const selectablePlans = computed(() =>
  availablePlans.value.filter(
    (p) => p.id !== props.currentPlanId && !p.isArchived,
  ),
)

async function loadPlans() {
  isLoadingPlans.value = true
  try {
    const response = await fetch('/api/plans?includeArchived=false')
    if (!response.ok) throw new Error('Fehler beim Laden der Pläne')
    const data = await response.json()
    availablePlans.value = data.plans
  } catch {
    emit('error', 'Pläne konnten nicht geladen werden.')
  } finally {
    isLoadingPlans.value = false
  }
}

// Load plans when dialog opens
watch(open, (isOpen) => {
  if (isOpen) {
    selectedPlanId.value = null
    loadPlans()
  }
})

async function handleMove() {
  if (!props.transaction || !selectedPlanId.value) return

  isMoving.value = true

  try {
    const response = await fetch(`/api/transactions/${props.transaction.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: selectedPlanId.value }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Fehler beim Verschieben')
    }

    const targetPlan = availablePlans.value.find(
      (p) => p.id === selectedPlanId.value,
    )
    const targetPlanName = targetPlan
      ? getPlanDisplayName(targetPlan.name, targetPlan.date)
      : 'Unbekannter Plan'

    open.value = false
    emit('moved', selectedPlanId.value, targetPlanName)
  } catch (error) {
    emit(
      'error',
      error instanceof Error
        ? error.message
        : 'Transaktion konnte nicht verschoben werden.',
    )
  } finally {
    isMoving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Transaktion verschieben</DialogTitle>
        <DialogDescription>
          Verschieben Sie "{{ transaction?.name }}" zu einem anderen Plan.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="target-plan">Zielplan</Label>
          <Select v-model="selectedPlanId" :disabled="isLoadingPlans">
            <SelectTrigger class="w-full">
              <SelectValue
                :placeholder="isLoadingPlans ? 'Lädt...' : 'Plan auswählen'"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="plan in selectablePlans"
                :key="plan.id"
                :value="plan.id"
              >
                {{ getPlanDisplayName(plan.name, plan.date) }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p
            v-if="selectablePlans.length === 0 && !isLoadingPlans"
            class="text-muted-foreground text-sm"
          >
            Keine anderen aktiven Pläne verfügbar.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" @click="open = false">
          Abbrechen
        </Button>
        <Button
          type="button"
          :disabled="isMoving || !selectedPlanId || isLoadingPlans"
          @click="handleMove"
        >
          <Loader2 v-if="isMoving" class="size-4 animate-spin" />
          Verschieben
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
