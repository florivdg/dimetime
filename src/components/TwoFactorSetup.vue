<script setup lang="ts">
import { ref, computed } from 'vue'
import { useForm } from 'vee-validate'
import { z } from 'zod'
import { qrcode } from '@lowlighter/qrcode'
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
  PinInput,
  PinInputGroup,
  PinInputSlot,
} from '@/components/ui/pin-input'
import { ShieldCheck, Copy, Check, Loader2 } from 'lucide-vue-next'

type SetupStep = 'password' | 'qrcode' | 'verify' | 'backup'

const currentStep = ref<SetupStep>('password')
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const totpUri = ref<string | null>(null)
const totpSecret = ref<string | null>(null)
const backupCodes = ref<string[]>([])
const copiedIndex = ref<number | null>(null)

const passwordSchema = z.object({
  password: z.string().min(1, 'Passwort ist erforderlich'),
})

const passwordForm = useForm({
  validationSchema: passwordSchema,
  initialValues: { password: '' },
})

const totpCode = ref<string[]>([])

const qrCodeSvg = computed(() => {
  if (!totpUri.value) return null
  return qrcode(totpUri.value, { output: 'svg' })
})

async function enableTwoFactor(password: string) {
  isLoading.value = true
  errorMessage.value = null

  try {
    const result = await authClient.twoFactor.enable({ password })

    if (result.error) {
      if (result.error.status === 400) {
        errorMessage.value = 'Falsches Passwort'
      } else {
        errorMessage.value = 'Ein Fehler ist aufgetreten'
      }
      return
    }

    if (result.data) {
      totpUri.value = result.data.totpURI
      totpSecret.value = result.data.secret
      backupCodes.value = result.data.backupCodes
      currentStep.value = 'qrcode'
    }
  } catch {
    errorMessage.value = 'Ein Fehler ist aufgetreten'
  } finally {
    isLoading.value = false
  }
}

async function verifyTotp() {
  const code = totpCode.value.join('')
  if (code.length !== 6) {
    errorMessage.value = 'Bitte geben Sie einen 6-stelligen Code ein'
    return
  }

  isLoading.value = true
  errorMessage.value = null

  try {
    const result = await authClient.twoFactor.verifyTotp({
      code,
      trustDevice: true,
    })

    if (result.error) {
      errorMessage.value = 'Ungültiger Code. Bitte versuchen Sie es erneut.'
      totpCode.value = []
      return
    }

    currentStep.value = 'backup'
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

function finishSetup() {
  window.location.href = '/'
}

const onPasswordSubmit = passwordForm.handleSubmit((values) => {
  enableTwoFactor(values.password)
})

function handlePinComplete(value: string[]) {
  totpCode.value = value
  if (value.join('').length === 6) {
    verifyTotp()
  }
}
</script>

<template>
  <Card>
    <CardHeader class="text-center">
      <div class="mb-4 flex justify-center">
        <div
          class="flex size-12 items-center justify-center rounded-lg bg-lime-500 text-white"
        >
          <ShieldCheck class="size-6" />
        </div>
      </div>
      <CardTitle class="text-2xl">Zwei-Faktor-Authentifizierung</CardTitle>
      <CardDescription>
        <template v-if="currentStep === 'password'">
          Bestätigen Sie Ihr Passwort, um 2FA einzurichten.
        </template>
        <template v-else-if="currentStep === 'qrcode'">
          Scannen Sie den QR-Code mit Ihrer Authenticator-App.
        </template>
        <template v-else-if="currentStep === 'verify'">
          Geben Sie den 6-stelligen Code aus Ihrer App ein.
        </template>
        <template v-else> Speichern Sie Ihre Backup-Codes sicher ab. </template>
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div
        v-if="errorMessage"
        class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm"
      >
        {{ errorMessage }}
      </div>

      <!-- Step 1: Password confirmation -->
      <form v-if="currentStep === 'password'" @submit="onPasswordSubmit">
        <div class="grid gap-4">
          <FormField v-slot="{ componentField }" name="password">
            <FormItem>
              <FormLabel>Passwort</FormLabel>
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
          <Button type="submit" class="w-full" :disabled="isLoading">
            <Loader2 v-if="isLoading" class="size-4 animate-spin" />
            {{ isLoading ? 'Wird eingerichtet...' : 'Weiter' }}
          </Button>
        </div>
      </form>

      <!-- Step 2: QR Code -->
      <div v-else-if="currentStep === 'qrcode'" class="space-y-4">
        <div
          v-if="qrCodeSvg"
          class="flex justify-center rounded-lg bg-white p-4"
          v-html="qrCodeSvg"
        />
        <div class="text-center">
          <p class="text-muted-foreground text-sm">
            Oder geben Sie diesen Code manuell ein:
          </p>
          <code class="bg-muted mt-2 block rounded px-2 py-1 text-sm">
            {{ totpSecret }}
          </code>
        </div>
        <Button class="w-full" @click="currentStep = 'verify'"> Weiter </Button>
      </div>

      <!-- Step 3: TOTP Verification -->
      <div v-else-if="currentStep === 'verify'" class="space-y-4">
        <div class="flex justify-center">
          <PinInput
            id="totp-input"
            v-model="totpCode"
            placeholder=""
            type="number"
            @complete="handlePinComplete"
          >
            <PinInputGroup>
              <PinInputSlot
                v-for="(_, index) in 6"
                :key="index"
                :index="index"
                class="size-12 text-lg"
              />
            </PinInputGroup>
          </PinInput>
        </div>
        <Button
          class="w-full"
          :disabled="isLoading || totpCode.join('').length !== 6"
          @click="verifyTotp"
        >
          <Loader2 v-if="isLoading" class="size-4 animate-spin" />
          {{ isLoading ? 'Wird überprüft...' : 'Bestätigen' }}
        </Button>
      </div>

      <!-- Step 4: Backup Codes -->
      <div v-else class="space-y-4">
        <div
          class="rounded-md border bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          <strong>Wichtig:</strong> Speichern Sie diese Codes sicher. Sie können
          diese nutzen, wenn Sie keinen Zugriff auf Ihre Authenticator-App
          haben.
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
        <Button class="w-full" @click="finishSetup">
          Einrichtung abschließen
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
