<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Category } from '@/lib/categories'
import type { PresetWithTags } from '@/lib/presets'
import { formatAmount, formatRecurrence } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowDown, ArrowUp, Clock, Edit2, Play, Trash2 } from 'lucide-vue-next'
import PresetEditDialog from './PresetEditDialog.vue'
import PresetApplyDialog from './PresetApplyDialog.vue'

const props = defineProps<{
  presets: PresetWithTags[]
  categories: Category[]
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}>()

const emit = defineEmits<{
  updated: []
  deleted: []
  applied: []
  error: [message: string]
  sort: [column: string]
}>()

const editDialogOpen = ref(false)
const applyDialogOpen = ref(false)
const deleteDialogOpen = ref(false)
const selectedPreset = ref<PresetWithTags | null>(null)
const presetToDelete = ref<PresetWithTags | null>(null)

function openEditDialog(preset: PresetWithTags) {
  selectedPreset.value = preset
  editDialogOpen.value = true
}

function openApplyDialog(preset: PresetWithTags) {
  selectedPreset.value = preset
  applyDialogOpen.value = true
}

function openDeleteDialog(preset: PresetWithTags) {
  presetToDelete.value = preset
  deleteDialogOpen.value = true
}

async function handleDelete() {
  if (!presetToDelete.value) return

  try {
    const response = await fetch(`/api/presets/${presetToDelete.value.id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Fehler beim Löschen')
    }

    emit('deleted')
  } catch (error) {
    emit(
      'error',
      error instanceof Error
        ? error.message
        : 'Vorlage konnte nicht gelöscht werden.',
    )
  } finally {
    deleteDialogOpen.value = false
    presetToDelete.value = null
  }
}

function handleSort(column: string) {
  emit('sort', column)
}

function isExpired(preset: PresetWithTags): boolean {
  if (!preset.endDate) return false
  const now = new Date()
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(now.getDate()).padStart(2, '0')}`
  return preset.endDate < localDate
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatLastUsed(timestamp: Date | string | number | null): string {
  // Handle null/undefined values
  if (!timestamp) return 'Nie'

  // Convert to Date based on type
  let date: Date
  if (timestamp instanceof Date) {
    // SSR initial load: Date object from Drizzle
    date = timestamp
  } else if (typeof timestamp === 'string') {
    // Client API fetch: ISO string from JSON.stringify
    date = new Date(timestamp)
  } else if (typeof timestamp === 'number') {
    // Future compatibility: milliseconds timestamp
    date = new Date(timestamp)
  } else {
    // Unknown type
    return 'Nie'
  }

  // Validate the Date is valid (not NaN)
  if (!Number.isFinite(date.getTime())) return 'Nie'

  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const SortIcon = computed(() => {
  return (column: string) => {
    if (props.sortBy !== column) return null
    return props.sortDir === 'asc' ? ArrowUp : ArrowDown
  }
})
</script>

<template>
  <div>
    <div
      v-if="presets.length === 0"
      class="rounded-md border border-dashed p-8 text-center"
    >
      <p class="text-muted-foreground text-sm">Keine Vorlagen gefunden.</p>
    </div>

    <div v-else class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                class="h-8 px-2"
                @click="handleSort('name')"
              >
                Name
                <component
                  :is="SortIcon('name')"
                  v-if="SortIcon('name')"
                  class="ml-1 size-4"
                />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                class="h-8 px-2"
                @click="handleSort('amount')"
              >
                Betrag
                <component
                  :is="SortIcon('amount')"
                  v-if="SortIcon('amount')"
                  class="ml-1 size-4"
                />
              </Button>
            </TableHead>
            <TableHead>Kategorie</TableHead>
            <TableHead>Wiederholung</TableHead>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                class="h-8 px-2"
                @click="handleSort('lastUsedAt')"
              >
                Zuletzt verwendet
                <component
                  :is="SortIcon('lastUsedAt')"
                  v-if="SortIcon('lastUsedAt')"
                  class="ml-1 size-4"
                />
              </Button>
            </TableHead>
            <TableHead class="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="preset in presets"
            :key="preset.id"
            :class="{ 'opacity-60': isExpired(preset) }"
          >
            <TableCell>
              <div class="flex items-center gap-2">
                {{ preset.name }}
                <Badge
                  v-if="isExpired(preset)"
                  variant="secondary"
                  class="gap-1"
                >
                  <Clock class="size-3" />
                  Abgelaufen
                </Badge>
              </div>
            </TableCell>
            <TableCell>
              <span
                :class="
                  preset.type === 'income' ? 'text-green-600' : 'text-red-600'
                "
              >
                {{ formatAmount(preset.amount) }}
              </span>
            </TableCell>
            <TableCell>
              <div v-if="preset.categoryName" class="flex items-center gap-2">
                <div
                  v-if="preset.categoryColor"
                  class="size-3 rounded-full"
                  :style="{ backgroundColor: preset.categoryColor }"
                />
                {{ preset.categoryName }}
              </div>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell>
              {{ formatRecurrence(preset.recurrence) }}
            </TableCell>
            <TableCell>
              {{ formatLastUsed(preset.lastUsedAt) }}
            </TableCell>
            <TableCell>
              <div class="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Anwenden"
                  @click="openApplyDialog(preset)"
                >
                  <Play class="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Bearbeiten"
                  @click="openEditDialog(preset)"
                >
                  <Edit2 class="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Löschen"
                  @click="openDeleteDialog(preset)"
                >
                  <Trash2 class="text-destructive size-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <PresetEditDialog
      v-model:open="editDialogOpen"
      :preset="selectedPreset"
      :categories="categories"
      @updated="emit('updated')"
      @error="(msg) => emit('error', msg)"
    />

    <PresetApplyDialog
      v-model:open="applyDialogOpen"
      :preset="selectedPreset"
      @applied="emit('applied')"
      @error="(msg) => emit('error', msg)"
    />

    <AlertDialog v-model:open="deleteDialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Vorlage löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Möchten Sie die Vorlage "{{ presetToDelete?.name }}" wirklich
            löschen? Diese Aktion kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction @click="handleDelete">Löschen</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
