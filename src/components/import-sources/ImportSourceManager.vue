<script setup lang="ts">
import { ref } from 'vue'
import type { ImportSource } from '@/lib/bank-transactions'
import type { ImportTypeDescriptor } from '@/lib/bank-import/types'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Database,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Trash2,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import ImportSourceCreateDialog from './ImportSourceCreateDialog.vue'
import ImportSourceEditDialog from './ImportSourceEditDialog.vue'

const props = defineProps<{
  initialSources: ImportSource[]
  importTypes: ImportTypeDescriptor[]
}>()

const sources = ref<ImportSource[]>(props.initialSources)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const isCreateDialogOpen = ref(false)
const isEditDialogOpen = ref(false)
const editingSource = ref<ImportSource | null>(null)

const sourceKindLabels: Record<string, string> = {
  bank_account: 'Bankkonto',
  credit_card: 'Kreditkarte',
  other: 'Sonstige',
}

const planAssignmentLabels: Record<string, string> = {
  auto_month: 'Automatisch nach Monat',
  none: 'Keine',
}

function getPresetName(preset: string): string {
  return props.importTypes.find((t) => t.preset === preset)?.name ?? preset
}

async function loadSources() {
  isLoading.value = true
  errorMessage.value = null
  try {
    const response = await fetch('/api/import-sources')
    if (!response.ok) throw new Error('Fehler beim Laden')
    const data = await response.json()
    sources.value = data.sources
  } catch {
    errorMessage.value = 'Import-Quellen konnten nicht geladen werden.'
  } finally {
    isLoading.value = false
  }
}

function handleCreated() {
  loadSources()
}

function startEditing(source: ImportSource) {
  editingSource.value = source
  isEditDialogOpen.value = true
}

function handleUpdated() {
  loadSources()
}

async function toggleActive(source: ImportSource) {
  try {
    const response = await fetch(`/api/import-sources/${source.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !source.isActive }),
    })
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Fehler beim Ändern des Status')
    }
    toast.success(
      source.isActive ? 'Import-Quelle deaktiviert' : 'Import-Quelle aktiviert',
    )
    await loadSources()
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : 'Status konnte nicht geändert werden.',
    )
  }
}

async function deleteSource(id: string) {
  try {
    const response = await fetch(`/api/import-sources/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Fehler beim Löschen')
    }
    toast.success('Import-Quelle gelöscht')
    await loadSources()
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : 'Import-Quelle konnte nicht gelöscht werden.',
    )
  }
}

function handleError(message: string) {
  errorMessage.value = message
}
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle class="flex items-center gap-2">
            <Database class="size-5" />
            Import-Quellen
          </CardTitle>
          <CardDescription>
            Verwalte deine Import-Quellen für Kontoauszüge.
          </CardDescription>
        </div>
        <ImportSourceCreateDialog
          v-model:open="isCreateDialogOpen"
          :import-types="importTypes"
          @created="handleCreated"
          @error="handleError"
        />
      </div>
    </CardHeader>
    <CardContent>
      <!-- Error message -->
      <div
        v-if="errorMessage"
        class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm"
      >
        {{ errorMessage }}
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Loader2 class="text-muted-foreground size-6 animate-spin" />
      </div>

      <!-- Empty state -->
      <div v-else-if="sources.length === 0" class="py-8 text-center">
        <Database class="text-muted-foreground mx-auto mb-4 size-12" />
        <p class="text-muted-foreground">
          Du hast noch keine Import-Quellen erstellt.
        </p>
      </div>

      <!-- Table -->
      <div v-else class="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Kontotyp</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead>Konto</TableHead>
              <TableHead>Planzuordnung</TableHead>
              <TableHead class="w-24 text-center">Status</TableHead>
              <TableHead class="w-28 text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="source in sources"
              :key="source.id"
              :class="{ 'opacity-50': !source.isActive }"
            >
              <TableCell class="font-medium">
                {{ source.name }}
              </TableCell>
              <TableCell>
                <code class="bg-muted rounded px-1.5 py-0.5 text-xs">
                  {{ getPresetName(source.preset) }}
                </code>
              </TableCell>
              <TableCell>
                {{ sourceKindLabels[source.sourceKind] ?? source.sourceKind }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ source.bankName || '–' }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ source.accountLabel || '–' }}
              </TableCell>
              <TableCell>
                <span class="text-muted-foreground text-sm">
                  {{
                    planAssignmentLabels[source.defaultPlanAssignment] ??
                    source.defaultPlanAssignment
                  }}
                </span>
              </TableCell>
              <TableCell class="text-center">
                <Badge :variant="source.isActive ? 'default' : 'secondary'">
                  {{ source.isActive ? 'Aktiv' : 'Inaktiv' }}
                </Badge>
              </TableCell>
              <TableCell class="text-right">
                <div class="flex justify-end gap-1">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    title="Bearbeiten"
                    @click="startEditing(source)"
                  >
                    <Pencil class="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    :title="source.isActive ? 'Deaktivieren' : 'Aktivieren'"
                    @click="toggleActive(source)"
                  >
                    <PowerOff v-if="source.isActive" class="size-4" />
                    <Power v-else class="size-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger as-child>
                      <Button size="icon-sm" variant="ghost" title="Löschen">
                        <Trash2 class="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Import-Quelle löschen?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Möchtest du die Import-Quelle "{{ source.name }}"
                          wirklich löschen? Dies ist nur möglich, wenn keine
                          Transaktionen mit dieser Quelle verknüpft sind.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction @click="deleteSource(source.id)">
                          Löschen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <!-- Edit Dialog -->
      <ImportSourceEditDialog
        v-model:open="isEditDialogOpen"
        :source="editingSource"
        :import-types="importTypes"
        @updated="handleUpdated"
        @error="handleError"
      />
    </CardContent>
  </Card>
</template>
