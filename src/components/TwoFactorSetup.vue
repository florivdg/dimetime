<script setup lang="ts">
import { ref, computed } from 'vue'
import { qrcode } from '@lowlighter/qrcode'
import { authClient } from '@/lib/auth-client'
import { useAuthAction } from '@/composables/useAuthAction'
import { usePasswordForm } from '@/composables/usePasswordForm'
import { useTwoFactorVerify } from '@/composables/useTwoFactorVerify'
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
import { useClipboard } from '@vueuse/core'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { ShieldCheck, Copy, Check, Loader2 } from 'lucide-vue-next'
import TwoFactorBackupCodes from '@/components/TwoFactorBackupCodes.vue'

type SetupStep = 'password' | 'qrcode' | 'verify' | 'backup'

const currentStep = ref<SetupStep>('password')
const totpUri = ref<string | null>(null)
const totpSecret = ref<string | null>(null)
const backupCodes = ref<string[]>([])
const { copy: copySecret, copied: secretCopied } = useClipboard()

const auth = useAuthAction()
const { isLoading, errorMessage, runWithErrorHandling } = auth
const { passwordForm } = usePasswordForm()
const { totpCode, verifyTotp, handlePinComplete } = useTwoFactorVerify(
  auth,
  () => {
    currentStep.value = 'backup'
  },
)

const qrCodeSvg = computed(() => {
  if (!totpUri.value) return null
  return qrcode(totpUri.value, { output: 'svg' })
})

async function enableTwoFactor(password: string) {
  const data = await runWithErrorHandling(
    () => authClient.twoFactor.enable({ password }),
    {
      400: 'Falsches Passwort',
      default: 'Ein Fehler ist aufgetreten',
    },
  )

  if (data) {
    totpUri.value = data.totpURI
    // Better Auth doesn't return the secret separately, so parse it from the URI
    const uriParams = new URL(data.totpURI).searchParams
    totpSecret.value = uriParams.get('secret')
    backupCodes.value = data.backupCodes
    currentStep.value = 'qrcode'
  }
}

function finishSetup() {
  window.location.href = '/'
}

const onPasswordSubmit = passwordForm.handleSubmit((values) => {
  enableTwoFactor(values.password)
})
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
          class="mx-auto max-w-48 rounded-lg bg-white p-4 [&>svg]:w-full"
          v-html="qrCodeSvg"
        />
        <div v-if="totpSecret" class="space-y-2">
          <p class="text-muted-foreground text-center text-sm">
            Oder geben Sie diesen Code manuell ein:
          </p>
          <InputGroup>
            <InputGroupInput
              :model-value="totpSecret"
              readonly
              class="text-center font-mono text-sm"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label="Kopieren"
                title="Kopieren"
                size="icon-xs"
                @click="copySecret(totpSecret!)"
              >
                <Check v-if="secretCopied" class="size-3.5" />
                <Copy v-else class="size-3.5" />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
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
      <TwoFactorBackupCodes
        v-else
        :codes="backupCodes"
        warning-text="Speichern Sie diese Codes sicher. Sie können diese nutzen, wenn Sie keinen Zugriff auf Ihre Authenticator-App haben."
      >
        <Button class="w-full" @click="finishSetup">
          Einrichtung abschließen
        </Button>
      </TwoFactorBackupCodes>
    </CardContent>
  </Card>
</template>
