<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { PresetWithTags } from '@/lib/presets'
import { formatAmount, formatRecurrence } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, FileStack, AlertCircle } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

type PresetWithMatch = PresetWithTags & { isMatching: boolean }

const props = defineProps<{
  planId: string
  planDate: string
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  applied: [count: number]
  error: [message: string]
}>()

const isLoading = ref(false)
const isApplying = ref(false)
const presets = ref<PresetWithMatch[]>([])
const selectedPresetIds = ref<Set<string>>(new Set())

const planMonth = computed(() => props.planDate.substring(0, 7))

const hasPresets = computed(() => presets.value.length > 0)
const hasSelectedPresets = computed(() => selectedPresetIds.value.size > 0)
const selectedCount = computed(() => selectedPresetIds.value.size)

// Load presets when dialog opens
watch(open, async (isOpen) => {
  if (isOpen) {
    await loadPresets()
  }
})

async function loadPresets() {
  isLoading.value = true
  presets.value = []
  selectedPresetIds.value = new Set()
  try {
    const response = await fetch(`/api/plans/${props.planId}/matching-presets`)
    if (!response.ok) throw new Error('Fehler beim Laden der Vorlagen')

    const data = await response.json()
    presets.value = data.presets

    // Pre-select matching presets
    selectedPresetIds.value = new Set(
      presets.value.filter((p) => p.isMatching).map((p) => p.id),
    )
  } catch {
    presets.value = []
    selectedPresetIds.value = new Set()
    emit('error', 'Vorlagen konnten nicht geladen werden.')
  } finally {
    isLoading.value = false
  }
}

function togglePreset(id: string) {
  if (selectedPresetIds.value.has(id)) {
    selectedPresetIds.value.delete(id)
  } else {
    selectedPresetIds.value.add(id)
  }
  // Trigger reactivity
  selectedPresetIds.value = new Set(selectedPresetIds.value)
}

function selectAll() {
  selectedPresetIds.value = new Set(presets.value.map((p) => p.id))
}

function deselectAll() {
  selectedPresetIds.value = new Set()
}

async function handleApply() {
  if (!hasSelectedPresets.value) return

  isApplying.value = true

  try {
    const response = await fetch('/api/presets/bulk-apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: props.planId,
        presetIds: Array.from(selectedPresetIds.value),
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Fehler beim Anwenden')
    }

    const data = await response.json()

    open.value = false
    toast.success(`${data.count} Vorlagen wurden angewendet`)
    emit('applied', data.count)
  } catch (error) {
    emit(
      'error',
      error instanceof Error
        ? error.message
        : 'Vorlagen konnten nicht angewendet werden.',
    )
  } finally {
    isApplying.value = false
  }
}

function getRecurrenceBadgeVariant(
  recurrence: string,
): 'default' | 'secondary' | 'outline' {
  switch (recurrence) {
    case 'monatlich':
      return 'default'
    case 'vierteljährlich':
      return 'secondary'
    case 'jährlich':
      return 'outline'
    default:
      return 'secondary'
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex max-h-[80vh] flex-col sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Vorlagen anwenden</DialogTitle>
        <DialogDescription>
          Wählen Sie die Vorlagen aus, die auf diesen Plan angewendet werden
          sollen. Passende Vorlagen sind bereits vorausgewählt.
        </DialogDescription>
      </DialogHeader>

      <!-- Loading state -->
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Loader2 class="text-muted-foreground size-6 animate-spin" />
      </div>

      <!-- Empty state -->
      <div v-else-if="!hasPresets" class="py-8 text-center">
        <FileStack class="text-muted-foreground mx-auto mb-4 size-12" />
        <p class="text-muted-foreground">Keine aktiven Vorlagen vorhanden.</p>
        <p class="text-muted-foreground mt-1 text-sm">
          <a href="/presets" class="text-primary hover:underline">
            Vorlagen verwalten
          </a>
        </p>
      </div>

      <!-- Presets table -->
      <div v-else class="min-h-0 flex-1 overflow-auto">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-muted-foreground text-sm">
            {{ selectedCount }} von {{ presets.length }} ausgewählt
          </span>
          <div class="flex gap-2">
            <Button variant="ghost" size="sm" @click="selectAll">
              Alle auswählen
            </Button>
            <Button variant="ghost" size="sm" @click="deselectAll">
              Auswahl aufheben
            </Button>
          </div>
        </div>

        <div class="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-12" />
                <TableHead>Name</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Wiederholung</TableHead>
                <TableHead class="text-right">Betrag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="preset in presets"
                :key="preset.id"
                :class="{ 'opacity-60': !preset.isMatching }"
                class="hover:bg-muted/50 cursor-pointer"
                @click="togglePreset(preset.id)"
              >
                <TableCell>
                  <Checkbox
                    :model-value="selectedPresetIds.has(preset.id)"
                    @update:model-value="togglePreset(preset.id)"
                    @click.stop
                  />
                </TableCell>
                <TableCell>
                  <div class="flex flex-col">
                    <span>{{ preset.name }}</span>
                    <span
                      v-if="!preset.isMatching"
                      class="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
                    >
                      <AlertCircle class="size-3" />
                      Passt nicht zum Planmonat
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div class="flex items-center gap-2">
                    <span
                      v-if="preset.categoryColor"
                      class="size-3 shrink-0 rounded-full"
                      :style="{ backgroundColor: preset.categoryColor }"
                    />
                    <span>{{ preset.categoryName || '-' }}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    :variant="getRecurrenceBadgeVariant(preset.recurrence)"
                  >
                    {{ formatRecurrence(preset.recurrence) }}
                  </Badge>
                </TableCell>
                <TableCell class="text-right">
                  <span
                    :class="
                      preset.type === 'income'
                        ? 'text-lime-600 dark:text-lime-400'
                        : 'text-rose-600 dark:text-rose-400'
                    "
                  >
                    {{ preset.type === 'income' ? '+' : '-'
                    }}{{ formatAmount(preset.amount) }}
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <DialogFooter class="mt-4">
        <Button type="button" variant="outline" @click="open = false">
          Abbrechen
        </Button>
        <Button
          type="button"
          :disabled="isApplying || !hasSelectedPresets"
          @click="handleApply"
        >
          <Loader2 v-if="isApplying" class="size-4 animate-spin" />
          {{ selectedCount }} Vorlagen anwenden
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
