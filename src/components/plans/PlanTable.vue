<script setup lang="ts">
import { ref } from 'vue'
import type { Plan } from '@/lib/plans'
import { formatDate, getPlanDisplayName, truncateText } from '@/lib/format'
import { mutateJson } from '@/lib/http'
import { useDeleteConfirmation } from '@/composables/useDeleteConfirmation'
import { useEditInputRefs } from '@/composables/useEditInputRefs'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  CalendarDays,
  Check,
  Loader2,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-vue-next'

const props = defineProps<{
  plans: Plan[]
  isLoading: boolean
  searchQuery: string
}>()

const emit = defineEmits<{
  updated: []
  deleted: []
  error: [message: string]
}>()

// Delete confirmation
const { deleteConfirmation, isDeleteConfirmed, resetDeleteConfirmation } =
  useDeleteConfirmation()

// Edit input refs
const { setEditInputRef, focusEditInputAsync } = useEditInputRefs()

// Edit state
const editingId = ref<string | null>(null)
const editName = ref('')
const editDate = ref('')
const editNotes = ref('')
const editIsArchived = ref(false)

function startEditing(plan: Plan) {
  editingId.value = plan.id
  editName.value = plan.name || ''
  editDate.value = plan.date
  editNotes.value = plan.notes || ''
  editIsArchived.value = plan.isArchived
  focusEditInputAsync(plan.id)
}

function cancelEditing() {
  editingId.value = null
  editName.value = ''
  editDate.value = ''
  editNotes.value = ''
  editIsArchived.value = false
}

async function updatePlan(id: string) {
  await mutateJson({
    url: `/api/plans/${id}`,
    method: 'PUT',
    body: {
      name: editName.value.trim() || null,
      date: editDate.value,
      notes: editNotes.value.trim() || null,
      isArchived: editIsArchived.value,
    },
    notOkMessage: 'Fehler beim Aktualisieren',
    fallbackMessage: 'Plan konnte nicht aktualisiert werden.',
    onSuccess: () => {
      cancelEditing()
      emit('updated')
    },
    onError: (message) => emit('error', message),
  })
}

async function deletePlan(id: string) {
  await mutateJson({
    url: `/api/plans/${id}`,
    method: 'DELETE',
    notOkMessage: 'Fehler beim Löschen',
    fallbackMessage: 'Plan konnte nicht gelöscht werden.',
    onSuccess: () => emit('deleted'),
    onError: (message) => emit('error', message),
  })
}
</script>

<template>
  <!-- Loading -->
  <div v-if="isLoading" class="flex items-center justify-center py-8">
    <Loader2 class="text-muted-foreground size-6 animate-spin" />
  </div>

  <!-- Empty state -->
  <div v-else-if="plans.length === 0 && !searchQuery" class="py-8 text-center">
    <CalendarDays class="text-muted-foreground mx-auto mb-4 size-12" />
    <p class="text-muted-foreground">Sie haben noch keine Pläne erstellt.</p>
  </div>

  <!-- No results -->
  <div v-else-if="plans.length === 0 && searchQuery" class="py-8 text-center">
    <Search class="text-muted-foreground mx-auto mb-4 size-12" />
    <p class="text-muted-foreground">
      Keine Pläne gefunden für "{{ searchQuery }}".
    </p>
  </div>

  <!-- Table -->
  <div v-else class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead class="w-32">Datum</TableHead>
          <TableHead>Notizen</TableHead>
          <TableHead class="w-24">Status</TableHead>
          <TableHead class="w-32">Erstellt</TableHead>
          <TableHead class="w-24 text-right">Aktionen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="plan in plans" :key="plan.id">
          <!-- Name -->
          <TableCell>
            <Input
              v-if="editingId === plan.id"
              :ref="(el) => setEditInputRef(plan.id, el as HTMLInputElement)"
              v-model="editName"
              class="h-8"
              placeholder="Planname..."
              @keyup.enter="updatePlan(plan.id)"
              @keyup.escape="cancelEditing"
            />
            <a
              v-else
              :href="`/plans/${plan.id}`"
              class="font-medium hover:underline"
            >
              {{ getPlanDisplayName(plan.name, plan.date) }}
            </a>
          </TableCell>

          <!-- Date -->
          <TableCell>
            <Input
              v-if="editingId === plan.id"
              v-model="editDate"
              type="date"
              class="h-8"
              @keyup.enter="updatePlan(plan.id)"
              @keyup.escape="cancelEditing"
            />
            <span v-else>{{ formatDate(plan.date) }}</span>
          </TableCell>

          <!-- Notes -->
          <TableCell class="text-muted-foreground">
            <Input
              v-if="editingId === plan.id"
              v-model="editNotes"
              class="h-8"
              placeholder="Notizen..."
              @keyup.enter="updatePlan(plan.id)"
              @keyup.escape="cancelEditing"
            />
            <span v-else>{{ truncateText(plan.notes, 50) }}</span>
          </TableCell>

          <!-- Status -->
          <TableCell>
            <div v-if="editingId === plan.id" class="flex items-center gap-2">
              <Checkbox :id="`archived-${plan.id}`" v-model="editIsArchived" />
              <label
                :for="`archived-${plan.id}`"
                class="cursor-pointer text-sm"
              >
                Archiviert
              </label>
            </div>
            <span
              v-else
              class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
              :class="
                plan.isArchived
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-300'
              "
            >
              {{ plan.isArchived ? 'Archiviert' : 'Aktiv' }}
            </span>
          </TableCell>

          <!-- Created -->
          <TableCell class="text-muted-foreground">
            <span>{{ formatDate(plan.createdAt) }}</span>
          </TableCell>

          <!-- Actions -->
          <TableCell class="text-right">
            <div v-if="editingId === plan.id" class="flex justify-end gap-1">
              <Button
                size="icon-sm"
                variant="ghost"
                title="Speichern"
                @click="updatePlan(plan.id)"
              >
                <Check class="size-4" />
                <span class="sr-only">Speichern</span>
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                title="Abbrechen"
                @click="cancelEditing"
              >
                <X class="size-4" />
                <span class="sr-only">Abbrechen</span>
              </Button>
            </div>
            <div v-else class="flex justify-end gap-1">
              <Button
                size="icon-sm"
                variant="ghost"
                title="Bearbeiten"
                @click="startEditing(plan)"
              >
                <Pencil class="size-4" />
              </Button>
              <AlertDialog @update:open="resetDeleteConfirmation">
                <AlertDialogTrigger as-child>
                  <Button size="icon-sm" variant="ghost" title="Löschen">
                    <Trash2 class="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Plan löschen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Möchten Sie den Plan "{{
                        getPlanDisplayName(plan.name, plan.date)
                      }}" wirklich löschen? Alle zugehörigen Transaktionen
                      werden ebenfalls gelöscht.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div class="space-y-2">
                    <Label for="delete-confirmation">
                      Geben Sie
                      <span class="font-semibold">löschen</span>
                      ein, um fortzufahren:
                    </Label>
                    <Input
                      id="delete-confirmation"
                      v-model="deleteConfirmation"
                      placeholder="löschen"
                      autocomplete="off"
                      @keyup.enter="isDeleteConfirmed && deletePlan(plan.id)"
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      :disabled="!isDeleteConfirmed"
                      @click="deletePlan(plan.id)"
                    >
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
</template>
