<script setup lang="ts">
import { ref, computed } from 'vue'
import { useForm } from 'vee-validate'
import { z } from 'zod'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ShieldCheck, Copy, Check, Loader2, RefreshCw } from 'lucide-vue-next'

const session = authClient.useSession()
const isTwoFactorEnabled = computed(
  () =>
    (session.value?.data?.user as { twoFactorEnabled?: boolean })
      ?.twoFactorEnabled ?? false,
)

const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const backupCodes = ref<string[]>([])
const showBackupCodes = ref(false)
const copiedIndex = ref<number | null>(null)
const dialogOpen = ref(false)

const passwordSchema = z.object({
  password: z.string().min(1, 'Passwort ist erforderlich'),
})

const passwordForm = useForm({
  validationSchema: passwordSchema,
  initialValues: { password: '' },
})

async function regenerateBackupCodes(password: string) {
  isLoading.value = true
  errorMessage.value = null
  successMessage.value = null

  try {
    const result = await authClient.twoFactor.generateBackupCodes({ password })

    if (result.error) {
      if (result.error.status === 400) {
        errorMessage.value = 'Falsches Passwort'
      } else {
        errorMessage.value = 'Ein Fehler ist aufgetreten'
      }
      return
    }

    if (result.data) {
      backupCodes.value = result.data.backupCodes
      showBackupCodes.value = true
      successMessage.value = 'Neue Backup-Codes wurden generiert'
      passwordForm.resetForm()
      dialogOpen.value = false
    }
  } catch {
    errorMessage.value = 'Ein Fehler ist aufgetreten'
  } finally {
    isLoading.value = false
  }
}

async function copyBackupCode(code: string, index: number) {
  await navigator.clipboard.writeText(code)
  copiedIndex.value = index
  setTimeout(() => {
    copiedIndex.value = null
  }, 2000)
}

async function copyAllBackupCodes() {
  await navigator.clipboard.writeText(backupCodes.value.join('\n'))
  copiedIndex.value = -1
  setTimeout(() => {
    copiedIndex.value = null
  }, 2000)
}

const onSubmit = passwordForm.handleSubmit((values) => {
  regenerateBackupCodes(values.password)
})

function closeBackupCodes() {
  showBackupCodes.value = false
  backupCodes.value = []
  successMessage.value = null
}
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle class="flex items-center gap-2">
            <ShieldCheck class="size-5" />
            Zwei-Faktor-Authentifizierung
          </CardTitle>
          <CardDescription>
            Verwalten Sie Ihre 2FA-Einstellungen und Backup-Codes.
          </CardDescription>
        </div>
        <div
          v-if="isTwoFactorEnabled"
          class="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
        >
          Aktiviert
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <div
        v-if="errorMessage"
        class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm"
      >
        {{ errorMessage }}
      </div>

      <div
        v-if="successMessage"
        class="mb-4 rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400"
      >
        {{ successMessage }}
      </div>

      <!-- Backup Codes Display -->
      <div v-if="showBackupCodes" class="mb-6 space-y-4">
        <div
          class="rounded-md border bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          <strong>Wichtig:</strong> Dies sind Ihre neuen Backup-Codes. Die alten
          Codes sind nicht mehr gültig.
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="(code, index) in backupCodes"
            :key="code"
            class="bg-muted flex items-center justify-between rounded px-3 py-2"
          >
            <code class="text-sm">{{ code }}</code>
            <Button
              size="icon"
              variant="ghost"
              class="size-6"
              @click="copyBackupCode(code, index)"
            >
              <Check v-if="copiedIndex === index" class="size-3" />
              <Copy v-else class="size-3" />
            </Button>
          </div>
        </div>
        <Button variant="outline" class="w-full" @click="copyAllBackupCodes">
          <Check v-if="copiedIndex === -1" class="size-4" />
          <Copy v-else class="size-4" />
          Alle Codes kopieren
        </Button>
        <Button variant="ghost" class="w-full" @click="closeBackupCodes">
          Schließen
        </Button>
      </div>

      <!-- Regenerate Backup Codes Form -->
      <div v-else>
        <p class="text-muted-foreground mb-4 text-sm">
          Sie können jederzeit neue Backup-Codes generieren. Die alten Codes
          werden dabei ungültig.
        </p>

        <AlertDialog v-model:open="dialogOpen">
          <AlertDialogTrigger as-child>
            <Button variant="outline" class="w-full">
              <RefreshCw class="size-4" />
              Neue Backup-Codes generieren
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Neue Backup-Codes generieren?</AlertDialogTitle>
              <AlertDialogDescription>
                Ihre aktuellen Backup-Codes werden ungültig. Stellen Sie sicher,
                dass Sie die neuen Codes sicher speichern.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <form @submit="onSubmit">
              <div class="my-4">
                <FormField v-slot="{ componentField }" name="password">
                  <FormItem>
                    <FormLabel>Passwort bestätigen</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="********"
                        autocomplete="current-password"
                        v-bind="componentField"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </FormField>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel type="button">Abbrechen</AlertDialogCancel>
                <Button type="submit" :disabled="isLoading">
                  <Loader2 v-if="isLoading" class="size-4 animate-spin" />
                  {{ isLoading ? 'Wird generiert...' : 'Generieren' }}
                </Button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </CardContent>
  </Card>
</template>
