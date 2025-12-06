<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useForm } from 'vee-validate'
import { z } from 'zod'
import { authClient } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
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
import { PiggyBank, Fingerprint } from 'lucide-vue-next'
import type { HTMLAttributes } from 'vue'

const props = defineProps<{
  class?: HTMLAttributes['class']
  redirectTo?: string
}>()

function getSafeRedirectUrl(url: string | undefined): string {
  const fallback = '/'
  if (!url) return fallback

  // Must be a relative path starting with /
  if (!url.startsWith('/')) return fallback

  // Block protocol-relative URLs (//evil.com)
  if (url.startsWith('//')) return fallback

  // Block dangerous protocols (javascript:, data:, vbscript:, etc.)
  const lowercaseUrl = url.toLowerCase()
  if (
    lowercaseUrl.includes('javascript:') ||
    lowercaseUrl.includes('data:') ||
    lowercaseUrl.includes('vbscript:')
  ) {
    return fallback
  }

  // Ensure it stays within the same origin
  try {
    const parsed = new URL(url, window.location.origin)
    if (parsed.origin !== window.location.origin) return fallback
  } catch {
    return fallback
  }

  return url
}

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'E-Mail ist erforderlich')
    .email('Ungueltige E-Mail-Adresse'),
  password: z
    .string()
    .min(1, 'Passwort ist erforderlich')
    .min(16, 'Passwort muss mindestens 16 Zeichen lang sein'),
})

const form = useForm({
  validationSchema: loginSchema,
  initialValues: {
    email: '',
    password: '',
  },
})

const isSubmitting = ref(false)
const isPasskeyLoading = ref(false)
const errorMessage = ref<string | null>(null)

async function handlePasskeyLogin() {
  isPasskeyLoading.value = true
  errorMessage.value = null
  try {
    await authClient.signIn.passkey({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = getSafeRedirectUrl(props.redirectTo)
        },
        onError: () => {
          errorMessage.value = 'Passkey-Anmeldung fehlgeschlagen.'
          isPasskeyLoading.value = false
        },
      },
    })
  } catch {
    errorMessage.value = 'Passkey-Anmeldung fehlgeschlagen.'
    isPasskeyLoading.value = false
  }
}

onMounted(async () => {
  if (
    window.PublicKeyCredential &&
    PublicKeyCredential.isConditionalMediationAvailable
  ) {
    const available =
      await PublicKeyCredential.isConditionalMediationAvailable()
    if (available) {
      authClient.signIn.passkey({
        autoFill: true,
        fetchOptions: {
          onSuccess: () => {
            window.location.href = getSafeRedirectUrl(props.redirectTo)
          },
        },
      })
    }
  }
})

const onSubmit = form.handleSubmit(async (values) => {
  isSubmitting.value = true
  errorMessage.value = null

  try {
    await authClient.signIn.email(
      {
        email: values.email,
        password: values.password,
      },
      {
        onSuccess: () => {
          // When 2FA is required, twoFactorClient's onTwoFactorRedirect handles the redirect
          // This callback only fires for users without 2FA (or after 2FA is verified)
          window.location.href = getSafeRedirectUrl(props.redirectTo)
        },
        onError: (ctx) => {
          if (ctx.error.status === 401) {
            errorMessage.value = 'Ungueltige Anmeldedaten'
          } else if (ctx.error.status === 403) {
            errorMessage.value = 'Zugriff verweigert'
          } else {
            errorMessage.value =
              'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.'
          }
        },
      },
    )
  } catch {
    errorMessage.value =
      'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.'
  } finally {
    isSubmitting.value = false
  }
})
</script>

<template>
  <div :class="cn('flex flex-col gap-6', props.class)">
    <Card>
      <CardHeader class="text-center">
        <div class="mb-4 flex justify-center">
          <div
            class="flex size-12 items-center justify-center rounded-lg bg-lime-500 text-white"
          >
            <PiggyBank class="size-6" />
          </div>
        </div>
        <CardTitle class="text-2xl">DimeTime</CardTitle>
        <CardDescription class="text-balance">
          Melde dich an, um auf das Dashboard zuzugreifen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form @submit="onSubmit">
          <div class="grid gap-6">
            <div
              v-if="errorMessage"
              class="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
            >
              {{ errorMessage }}
            </div>

            <FormField v-slot="{ componentField }" name="email">
              <FormItem>
                <FormLabel>E-Mail</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="admin@dimetime.org"
                    autocomplete="username webauthn"
                    v-bind="componentField"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="password">
              <FormItem>
                <FormLabel>Passwort</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="********"
                    autocomplete="current-password webauthn"
                    v-bind="componentField"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <Button type="submit" class="w-full" :disabled="isSubmitting">
              {{ isSubmitting ? 'Anmelden...' : 'Anmelden' }}
            </Button>

            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <span class="w-full border-t" />
              </div>
              <div class="relative flex justify-center text-xs uppercase">
                <span class="bg-card text-muted-foreground px-2">oder</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              class="w-full"
              :disabled="isPasskeyLoading"
              @click="handlePasskeyLogin"
            >
              <Fingerprint class="size-4" />
              {{
                isPasskeyLoading
                  ? 'Passkey wird geprueft...'
                  : 'Mit Passkey anmelden'
              }}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
