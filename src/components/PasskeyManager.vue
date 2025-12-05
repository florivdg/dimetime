<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { Input } from '@/components/ui/input'
import { Fingerprint, Plus, Trash2, Pencil, Loader2 } from 'lucide-vue-next'

interface Passkey {
  id: string
  name: string | null
  deviceType: string
  createdAt: Date
}

const passkeys = ref<Passkey[]>([])
const isLoading = ref(true)
const isAdding = ref(false)
const editingId = ref<string | null>(null)
const editName = ref('')
const errorMessage = ref<string | null>(null)
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

async function loadPasskeys() {
  isLoading.value = true
  errorMessage.value = null
  try {
    const result = await authClient.passkey.listUserPasskeys()
    if (result.data) {
      passkeys.value = result.data as Passkey[]
    }
  } catch {
    errorMessage.value = 'Passkeys konnten nicht geladen werden.'
  } finally {
    isLoading.value = false
  }
}

async function addPasskey() {
  isAdding.value = true
  errorMessage.value = null
  try {
    await authClient.passkey.addPasskey({
      authenticatorAttachment: 'platform',
    })
    await loadPasskeys()
  } catch {
    errorMessage.value = 'Passkey konnte nicht hinzugefügt werden.'
  } finally {
    isAdding.value = false
  }
}

async function deletePasskey(id: string) {
  errorMessage.value = null
  try {
    await authClient.passkey.deletePasskey({ id })
    await loadPasskeys()
  } catch {
    errorMessage.value = 'Passkey konnte nicht gelöscht werden.'
  }
}

function startEditing(passkey: Passkey) {
  editingId.value = passkey.id
  editName.value = passkey.name || ''
  nextTick(() => {
    focusEditInput(passkey.id)
  })
}

function cancelEditing() {
  editingId.value = null
  editName.value = ''
}

async function saveEdit(id: string) {
  errorMessage.value = null
  try {
    await authClient.passkey.updatePasskey({
      id,
      name: editName.value,
    })
    await loadPasskeys()
    cancelEditing()
  } catch {
    errorMessage.value = 'Passkey konnte nicht aktualisiert werden.'
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

function getDeviceTypeLabel(deviceType: string): string {
  switch (deviceType) {
    case 'singleDevice':
      return 'Einzelgerät'
    case 'multiDevice':
      return 'Mehrere Geräte'
    default:
      return deviceType
  }
}

onMounted(() => {
  loadPasskeys()
})
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle class="flex items-center gap-2">
            <Fingerprint class="size-5" />
            Passkeys
          </CardTitle>
          <CardDescription>
            Verwalten Sie Ihre Passkeys für passwortlose Anmeldung.
          </CardDescription>
        </div>
        <Button @click="addPasskey" :disabled="isAdding">
          <Loader2 v-if="isAdding" class="size-4 animate-spin" />
          <Plus v-else class="size-4" />
          Passkey hinzufügen
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      <div
        v-if="errorMessage"
        class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm"
      >
        {{ errorMessage }}
      </div>

      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Loader2 class="text-muted-foreground size-6 animate-spin" />
      </div>

      <div v-else-if="passkeys.length === 0" class="py-8 text-center">
        <Fingerprint class="text-muted-foreground mx-auto mb-4 size-12" />
        <p class="text-muted-foreground">
          Sie haben noch keine Passkeys eingerichtet.
        </p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="passkey in passkeys"
          :key="passkey.id"
          class="bg-muted/50 flex items-center justify-between rounded-lg p-4"
        >
          <div class="flex items-center gap-4">
            <Fingerprint class="text-muted-foreground size-8" />
            <div>
              <div
                v-if="editingId === passkey.id"
                class="flex items-center gap-2"
              >
                <Input
                  v-model="editName"
                  :ref="
                    (el) => setEditInputRef(passkey.id, el as HTMLInputElement)
                  "
                  placeholder="Passkey-Name"
                  class="h-8 w-48"
                  @keyup.enter="saveEdit(passkey.id)"
                  @keyup.escape="cancelEditing"
                />
                <Button size="sm" variant="ghost" @click="saveEdit(passkey.id)">
                  Speichern
                </Button>
                <Button size="sm" variant="ghost" @click="cancelEditing">
                  Abbrechen
                </Button>
              </div>
              <template v-else>
                <p class="font-medium">
                  {{ passkey.name || 'Unbenannter Passkey' }}
                </p>
                <p class="text-muted-foreground text-sm">
                  {{ getDeviceTypeLabel(passkey.deviceType) }} &middot; Erstellt
                  am {{ formatDate(passkey.createdAt) }}
                </p>
              </template>
            </div>
          </div>
          <div v-if="editingId !== passkey.id" class="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              @click="startEditing(passkey)"
              title="Umbenennen"
            >
              <Pencil class="size-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger as-child>
                <Button size="icon" variant="ghost" title="Löschen">
                  <Trash2 class="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Passkey löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Möchten Sie diesen Passkey wirklich löschen? Sie können sich
                    dann nicht mehr mit diesem Passkey anmelden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction @click="deletePasskey(passkey.id)">
                    Löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
