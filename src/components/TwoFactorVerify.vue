<script setup lang="ts">
import { ref } from 'vue'
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
  PinInput,
  PinInputGroup,
  PinInputSlot,
} from '@/components/ui/pin-input'
import { ShieldCheck, Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  redirectTo?: string
}>()

const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const totpCode = ref<string[]>([])
const showBackupInput = ref(false)
const backupCode = ref('')

function getSafeRedirectUrl(url: string | undefined): string {
  const fallback = '/'
  if (!url) return fallback
  if (!url.startsWith('/')) return fallback
  if (url.startsWith('//')) return fallback
  const lowercaseUrl = url.toLowerCase()
  if (
    lowercaseUrl.includes('javascript:') ||
    lowercaseUrl.includes('data:') ||
    lowercaseUrl.includes('vbscript:')
  ) {
    return fallback
  }
  return url
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

    window.location.href = getSafeRedirectUrl(props.redirectTo)
  } catch {
    errorMessage.value = 'Ein Fehler ist aufgetreten'
  } finally {
    isLoading.value = false
  }
}

async function verifyBackupCode() {
  if (!backupCode.value.trim()) {
    errorMessage.value = 'Bitte geben Sie einen Backup-Code ein'
    return
  }

  isLoading.value = true
  errorMessage.value = null

  try {
    const result = await authClient.twoFactor.verifyBackupCode({
      code: backupCode.value.trim(),
      trustDevice: true,
    })

    if (result.error) {
      errorMessage.value = 'Ungültiger Backup-Code'
      return
    }

    window.location.href = getSafeRedirectUrl(props.redirectTo)
  } catch {
    errorMessage.value = 'Ein Fehler ist aufgetreten'
  } finally {
    isLoading.value = false
  }
}

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
        {{
          showBackupInput
            ? 'Geben Sie einen Ihrer Backup-Codes ein.'
            : 'Geben Sie den Code aus Ihrer Authenticator-App ein.'
        }}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div
        v-if="errorMessage"
        class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm"
      >
        {{ errorMessage }}
      </div>

      <!-- TOTP Input -->
      <div v-if="!showBackupInput" class="space-y-4">
        <div class="flex justify-center">
          <PinInput
            id="totp-verify-input"
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
        <div class="text-center">
          <Button
            variant="link"
            class="text-muted-foreground text-sm"
            @click="showBackupInput = true"
          >
            Backup-Code verwenden
          </Button>
        </div>
      </div>

      <!-- Backup Code Input -->
      <div v-else class="space-y-4">
        <Input
          v-model="backupCode"
          placeholder="Backup-Code"
          class="text-center"
          @keyup.enter="verifyBackupCode"
        />
        <Button
          class="w-full"
          :disabled="isLoading || !backupCode.trim()"
          @click="verifyBackupCode"
        >
          <Loader2 v-if="isLoading" class="size-4 animate-spin" />
          {{ isLoading ? 'Wird überprüft...' : 'Bestätigen' }}
        </Button>
        <div class="text-center">
          <Button
            variant="link"
            class="text-muted-foreground text-sm"
            @click="showBackupInput = false"
          >
            Authenticator-App verwenden
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
