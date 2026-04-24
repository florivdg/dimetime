<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { toast } from 'vue-sonner'
import { formatDateTime } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from 'lucide-vue-next'

interface ApiKeyEntry {
  id: string
  name: string | null
  start: string | null
  prefix: string | null
  createdAt: string
  expiresAt: string | null
  enabled: boolean
}

const keys = ref<ApiKeyEntry[]>([])
const isLoading = ref(true)
const createOpen = ref(false)
const isCreating = ref(false)
const newName = ref('')
const newExpiresIn = ref<string>('2592000') // 30 Tage in Sekunden
const generatedKey = ref<string | null>(null)
const copied = ref(false)

const canSubmit = computed(() => newName.value.trim().length > 0)

const expiresInOptions = [
  { value: '2592000', label: '30 Tage' },
  { value: '7776000', label: '90 Tage' },
  { value: '31536000', label: '1 Jahr' },
  { value: 'never', label: 'Kein Ablauf' },
]

async function loadKeys() {
  isLoading.value = true
  try {
    const response = await fetch('/api/auth/api-key/list', {
      credentials: 'same-origin',
    })
    if (!response.ok) {
      throw new Error('Keys konnten nicht geladen werden')
    }
    const data = (await response.json()) as
      | ApiKeyEntry[]
      | { apiKeys: ApiKeyEntry[] }
    const list = Array.isArray(data) ? data : (data.apiKeys ?? [])
    keys.value = list
  } catch {
    toast.error('API-Keys konnten nicht geladen werden.')
  } finally {
    isLoading.value = false
  }
}

function resetCreateForm() {
  newName.value = ''
  newExpiresIn.value = '2592000'
}

async function createKey() {
  if (!canSubmit.value || isCreating.value) return
  isCreating.value = true
  try {
    const expiresIn =
      newExpiresIn.value === 'never' ? null : Number(newExpiresIn.value)
    const response = await fetch('/api/settings/companion-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        name: newName.value.trim(),
        expiresIn,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Fehler beim Erstellen')
    }

    generatedKey.value = data.key
    copied.value = false
    createOpen.value = false
    resetCreateForm()
    toast.success('API-Key erstellt')
    await loadKeys()
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : 'API-Key konnte nicht erstellt werden',
    )
  } finally {
    isCreating.value = false
  }
}

async function deleteKey(keyId: string) {
  try {
    const response = await fetch('/api/auth/api-key/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ keyId }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error?.message || 'Fehler beim Löschen')
    }
    toast.success('API-Key widerrufen')
    await loadKeys()
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : 'API-Key konnte nicht gelöscht werden',
    )
  }
}

async function copyGeneratedKey() {
  if (!generatedKey.value) return
  try {
    await navigator.clipboard.writeText(generatedKey.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    toast.error('Zwischenablage nicht verfügbar')
  }
}

function dismissGeneratedKey() {
  generatedKey.value = null
  copied.value = false
}

function formatPrefix(key: ApiKeyEntry): string {
  const prefix = key.prefix ?? ''
  const start = key.start ?? ''
  return `${prefix}${start}…`
}

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return 'Kein Ablauf'
  return formatDateTime(new Date(expiresAt))
}

onMounted(() => {
  loadKeys()
})
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle class="flex items-center gap-2">
            <KeyRound class="size-5" />
            Companion-App-Keys
          </CardTitle>
          <CardDescription>
            Erzeuge API-Keys für eine Companion-App, die Banktransaktionen
            automatisiert importieren darf.
          </CardDescription>
        </div>
        <Dialog v-model:open="createOpen">
          <Button @click="createOpen = true">
            <Plus class="size-4" />
            Key erstellen
          </Button>
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Companion-App-Key erstellen</DialogTitle>
              <DialogDescription>
                Der Key erlaubt ausschließlich das Schreiben von
                Banktransaktionen. Nach dem Erstellen wird er genau einmal
                angezeigt.
              </DialogDescription>
            </DialogHeader>
            <form class="space-y-4" @submit.prevent="createKey">
              <div class="space-y-2">
                <Label for="api-key-name">Name *</Label>
                <Input
                  id="api-key-name"
                  v-model="newName"
                  placeholder="z.B. Companion Desktop"
                  autocomplete="off"
                />
              </div>
              <div class="space-y-2">
                <Label for="api-key-expires">Ablauf</Label>
                <Select v-model="newExpiresIn">
                  <SelectTrigger id="api-key-expires">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="option in expiresInOptions"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  @click="createOpen = false"
                >
                  Abbrechen
                </Button>
                <Button type="submit" :disabled="!canSubmit || isCreating">
                  <Loader2 v-if="isCreating" class="size-4 animate-spin" />
                  Erstellen
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </CardHeader>
    <CardContent>
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Loader2 class="text-muted-foreground size-6 animate-spin" />
      </div>

      <div v-else-if="keys.length === 0" class="py-8 text-center">
        <KeyRound class="text-muted-foreground mx-auto mb-4 size-12" />
        <p class="text-muted-foreground">
          Es wurden noch keine Companion-App-Keys erstellt.
        </p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="key in keys"
          :key="key.id"
          class="bg-muted/50 flex items-center justify-between rounded-lg p-4"
        >
          <div class="flex items-center gap-4">
            <KeyRound class="text-muted-foreground size-8" />
            <div>
              <p class="font-medium">
                {{ key.name || 'Unbenannter Key' }}
              </p>
              <p class="text-muted-foreground text-sm">
                <code class="font-mono">{{ formatPrefix(key) }}</code>
                &middot; Erstellt am {{ formatDateTime(new Date(key.createdAt))
                }}<span v-if="key.expiresAt">
                  &middot; Läuft ab am {{ formatExpiry(key.expiresAt) }}</span
                ><span v-else> &middot; Kein Ablauf</span>
              </p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger as-child>
              <Button size="icon" variant="ghost" title="Widerrufen">
                <Trash2 class="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>API-Key widerrufen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Nach dem Widerruf kann die Companion-App keine Transaktionen
                  mehr senden. Diese Aktion kann nicht rückgängig gemacht
                  werden.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction @click="deleteKey(key.id)">
                  Widerrufen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </CardContent>
  </Card>

  <AlertDialog
    :open="generatedKey !== null"
    @update:open="(open) => !open && dismissGeneratedKey()"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>API-Key erfolgreich erstellt</AlertDialogTitle>
        <AlertDialogDescription>
          Kopiere den Schlüssel jetzt und hinterlege ihn in der Companion-App.
          Er wird nicht erneut angezeigt.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div
        class="bg-muted text-muted-foreground flex items-center justify-between gap-2 rounded-md p-3 font-mono text-sm break-all"
      >
        <code>{{ generatedKey }}</code>
        <Button
          size="icon"
          variant="ghost"
          class="shrink-0"
          @click="copyGeneratedKey"
          :title="copied ? 'Kopiert' : 'Kopieren'"
        >
          <Check v-if="copied" class="size-4" />
          <Copy v-else class="size-4" />
        </Button>
      </div>
      <AlertDialogFooter>
        <AlertDialogAction @click="dismissGeneratedKey">
          Schließen
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
