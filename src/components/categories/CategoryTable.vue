<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import type { Category } from '@/lib/categories'
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
import {
  Check,
  Loader2,
  Pencil,
  Search,
  Tags,
  Trash2,
  X,
} from 'lucide-vue-next'

const props = defineProps<{
  categories: Category[]
  isLoading: boolean
  searchQuery: string
}>()

const emit = defineEmits<{
  updated: []
  deleted: []
  error: [message: string]
}>()

// Edit state
const editingId = ref<string | null>(null)
const editName = ref('')
const editSlug = ref('')
const editColor = ref('')
const editInputRefs = ref<
  Record<string, HTMLInputElement | ComponentPublicInstance | null>
>({})

function setEditInputRef(
  id: string,
  el: HTMLInputElement | ComponentPublicInstance | null,
) {
  if (el === null) {
    delete editInputRefs.value[id]
    return
  }
  editInputRefs.value[id] = el
}

function focusEditInput(id: string) {
  const refValue = editInputRefs.value[id]
  const inputEl =
    refValue instanceof HTMLInputElement
      ? refValue
      : (refValue as ComponentPublicInstance | undefined)?.$el
  if (inputEl instanceof HTMLInputElement) {
    inputEl.focus()
    inputEl.select?.()
  }
}

function startEditing(category: Category) {
  editingId.value = category.id
  editName.value = category.name
  editSlug.value = category.slug
  editColor.value = category.color || '#6366f1'
  nextTick(() => {
    focusEditInput(category.id)
  })
}

function cancelEditing() {
  editingId.value = null
  editName.value = ''
  editSlug.value = ''
  editColor.value = ''
}

async function updateCategory(id: string) {
  try {
    const response = await fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName.value.trim(),
        slug: editSlug.value.trim(),
        color: editColor.value || null,
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Fehler beim Aktualisieren')
    }

    cancelEditing()
    emit('updated')
  } catch (error) {
    emit(
      'error',
      error instanceof Error
        ? error.message
        : 'Kategorie konnte nicht aktualisiert werden.',
    )
  }
}

async function deleteCategory(id: string) {
  try {
    const response = await fetch(`/api/categories/${id}`, {
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
        : 'Kategorie konnte nicht gelöscht werden.',
    )
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
  }).format(new Date(date))
}
</script>

<template>
  <!-- Loading -->
  <div v-if="isLoading" class="flex items-center justify-center py-8">
    <Loader2 class="text-muted-foreground size-6 animate-spin" />
  </div>

  <!-- Empty state -->
  <div
    v-else-if="categories.length === 0 && !searchQuery"
    class="py-8 text-center"
  >
    <Tags class="text-muted-foreground mx-auto mb-4 size-12" />
    <p class="text-muted-foreground">
      Sie haben noch keine Kategorien erstellt.
    </p>
  </div>

  <!-- No results -->
  <div
    v-else-if="categories.length === 0 && searchQuery"
    class="py-8 text-center"
  >
    <Search class="text-muted-foreground mx-auto mb-4 size-12" />
    <p class="text-muted-foreground">
      Keine Kategorien gefunden für "{{ searchQuery }}".
    </p>
  </div>

  <!-- Table -->
  <div v-else class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-16">Farbe</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead class="w-32">Erstellt</TableHead>
          <TableHead class="w-24 text-right">Aktionen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="cat in categories" :key="cat.id">
          <!-- Color -->
          <TableCell>
            <template v-if="editingId === cat.id">
              <input
                v-model="editColor"
                type="color"
                class="h-8 w-10 cursor-pointer rounded border p-0.5"
              />
            </template>
            <template v-else>
              <div
                v-if="cat.color"
                class="size-6 rounded-full border"
                :style="{ backgroundColor: cat.color }"
              />
              <div v-else class="bg-muted size-6 rounded-full border" />
            </template>
          </TableCell>

          <!-- Name -->
          <TableCell>
            <template v-if="editingId === cat.id">
              <Input
                :ref="(el) => setEditInputRef(cat.id, el as HTMLInputElement)"
                v-model="editName"
                class="h-8"
                @keyup.enter="updateCategory(cat.id)"
                @keyup.escape="cancelEditing"
              />
            </template>
            <template v-else>
              <span class="font-medium">{{ cat.name }}</span>
            </template>
          </TableCell>

          <!-- Slug -->
          <TableCell>
            <template v-if="editingId === cat.id">
              <Input
                v-model="editSlug"
                class="h-8 font-mono"
                @keyup.enter="updateCategory(cat.id)"
                @keyup.escape="cancelEditing"
              />
            </template>
            <template v-else>
              <code class="bg-muted rounded px-1.5 py-0.5 text-sm">{{
                cat.slug
              }}</code>
            </template>
          </TableCell>

          <!-- Created -->
          <TableCell class="text-muted-foreground">
            {{ formatDate(cat.createdAt) }}
          </TableCell>

          <!-- Actions -->
          <TableCell class="text-right">
            <template v-if="editingId === cat.id">
              <div class="flex justify-end gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  title="Speichern"
                  @click="updateCategory(cat.id)"
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
            </template>
            <template v-else>
              <div class="flex justify-end gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  title="Bearbeiten"
                  @click="startEditing(cat)"
                >
                  <Pencil class="size-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger as-child>
                    <Button size="icon-sm" variant="ghost" title="Löschen">
                      <Trash2 class="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Kategorie löschen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Möchten Sie die Kategorie "{{ cat.name }}" wirklich
                        löschen? Transaktionen mit dieser Kategorie werden nicht
                        gelöscht, aber die Kategorie-Zuordnung wird entfernt.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction @click="deleteCategory(cat.id)">
                        Löschen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </template>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
