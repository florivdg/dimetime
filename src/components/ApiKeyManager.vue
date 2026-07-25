<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useClipboard } from '@vueuse/core'
import { formatDateTime } from '@/lib/format'
import { authClient } from '@/lib/auth-client'
import { useAuthAction } from '@/composables/useAuthAction'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from 'lucide-vue-next'

interface ApiKeyItem {
  id: string
  name: string | null
  start: string | null
  createdAt: string | Date
}

/** Matches the plugin's default `maximumNameLength`. */
const MAX_NAME_LENGTH = 32

const apiKeys = ref<ApiKeyItem[]>([])
const newKeyName = ref('')
const createdKey = ref<string | null>(null)
const { copy: copyCreatedKey, copied: hasCopied } = useClipboard()

const {
  isLoading: isListLoading,
  errorMessage: listError,
  runWithErrorHandling: runListAction,
} = useAuthAction()

// Creating and revoking share one action so the list keeps rendering while a
// mutation is in flight; only the initial/refreshing list swaps in a spinner.
const {
  isLoading: isMutating,
  errorMessage: mutationError,
  runWithErrorHandling: runMutation,
} = useAuthAction()

const nameError = ref<string | null>(null)
const hasLoadedOnce = ref(false)

const errorMessage = computed(
  () => nameError.value ?? mutationError.value ?? listError.value,
)
/** The first render happens before `onMounted` fires, so show the spinner. */
const isListPending = computed(
  () => !hasLoadedOnce.value || isListLoading.value,
)

async function loadApiKeys() {
  const data = await runListAction(() => authClient.apiKey.list(), {
    default: 'API-Schlüssel konnten nicht geladen werden.',
  })
  hasLoadedOnce.value = true
  if (data) {
    apiKeys.value = (data.apiKeys ?? []) as unknown as ApiKeyItem[]
  }
}

async function createApiKey() {
  const name = newKeyName.value.trim()
  if (!name) {
    nameError.value = 'Bitte geben Sie einen Namen für den Schlüssel an.'
    return
  }
  nameError.value = null

  const data = await runMutation(() => authClient.apiKey.create({ name }), {
    default: 'API-Schlüssel konnte nicht erstellt werden.',
  })
  if (!data) return

  createdKey.value = data.key
  newKeyName.value = ''
  await loadApiKeys()
}

async function deleteApiKey(keyId: string) {
  nameError.value = null

  const data = await runMutation(() => authClient.apiKey.delete({ keyId }), {
    default: 'API-Schlüssel konnte nicht widerrufen werden.',
  })
  if (!data) return

  apiKeys.value = apiKeys.value.filter((item) => item.id !== keyId)
}

function keyMeta(item: ApiKeyItem): string {
  const created = `Erstellt am ${formatDateTime(item.createdAt)}`
  return item.start ? `${item.start}… · ${created}` : created
}

onMounted(() => {
  loadApiKeys()
})
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <KeyRound class="size-5" />
        API-Schlüssel
      </CardTitle>
      <CardDescription>
        Erstellen Sie Schlüssel für den lesenden Zugriff auf die API. Senden Sie
        den Schlüssel als Header
        <code class="bg-muted rounded px-1 py-0.5 text-xs">x-api-key</code> bei
        GET-Anfragen an
        <code class="bg-muted rounded px-1 py-0.5 text-xs">/api/…</code>.
        Ändernde Anfragen sind mit API-Schlüsseln nicht möglich.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div
        v-if="errorMessage"
        class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm"
      >
        {{ errorMessage }}
      </div>

      <form class="mb-4 flex items-center gap-2" @submit.prevent="createApiKey">
        <Input
          v-model="newKeyName"
          :maxlength="MAX_NAME_LENGTH"
          placeholder="Name des Schlüssels"
          aria-label="Name des Schlüssels"
          class="max-w-xs"
        />
        <Button type="submit" :disabled="isMutating">
          <Loader2 v-if="isMutating" class="size-4 animate-spin" />
          <Plus v-else class="size-4" />
          Schlüssel erstellen
        </Button>
      </form>

      <div v-if="isListPending" class="flex items-center justify-center py-8">
        <Loader2 class="text-muted-foreground size-6 animate-spin" />
      </div>

      <div v-else-if="apiKeys.length === 0" class="py-8 text-center">
        <KeyRound class="text-muted-foreground mx-auto mb-4 size-12" />
        <p class="text-muted-foreground">
          Sie haben noch keine API-Schlüssel erstellt.
        </p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="apiKey in apiKeys"
          :key="apiKey.id"
          class="bg-muted/50 flex items-center justify-between rounded-lg p-4"
        >
          <div class="flex items-center gap-4">
            <KeyRound class="text-muted-foreground size-8" />
            <div>
              <p class="font-medium">
                {{ apiKey.name ?? 'Unbenannter Schlüssel' }}
              </p>
              <p class="text-muted-foreground text-sm">
                {{ keyMeta(apiKey) }}
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
                <AlertDialogTitle>API-Schlüssel widerrufen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Möchten Sie diesen Schlüssel wirklich widerrufen? Anwendungen,
                  die ihn verwenden, verlieren sofort den Zugriff.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction @click="deleteApiKey(apiKey.id)">
                  Widerrufen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </CardContent>
  </Card>

  <Dialog
    :open="createdKey !== null"
    @update:open="(open: boolean) => !open && (createdKey = null)"
  >
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Neuer API-Schlüssel</DialogTitle>
        <DialogDescription>
          Kopieren Sie den Schlüssel jetzt. Er wird aus Sicherheitsgründen nur
          ein einziges Mal angezeigt.
        </DialogDescription>
      </DialogHeader>
      <div class="flex items-center gap-2">
        <code
          class="bg-muted flex-1 overflow-x-auto rounded-md p-3 font-mono text-sm break-all"
        >
          {{ createdKey }}
        </code>
        <Button
          size="icon"
          variant="outline"
          title="Schlüssel kopieren"
          @click="copyCreatedKey(createdKey!)"
        >
          <Check v-if="hasCopied" class="size-4" />
          <Copy v-else class="size-4" />
        </Button>
      </div>
      <!-- Empty until something was copied; the slot keeps its height either way. -->
      <p class="text-muted-foreground min-h-5 text-sm">
        {{ hasCopied ? 'Schlüssel wurde in die Zwischenablage kopiert.' : '' }}
      </p>
      <DialogFooter>
        <Button @click="createdKey = null">Fertig</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
