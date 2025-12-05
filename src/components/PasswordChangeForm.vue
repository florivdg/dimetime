<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { z } from 'zod'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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
import { KeyRound } from 'lucide-vue-next'

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Aktuelles Passwort ist erforderlich'),
    newPassword: z
      .string()
      .min(1, 'Neues Passwort ist erforderlich')
      .min(16, 'Neues Passwort muss mindestens 16 Zeichen lang sein'),
    confirmPassword: z.string().min(1, 'Passwort-Bestätigung ist erforderlich'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwörter stimmen nicht überein',
    path: ['confirmPassword'],
  })

const form = useForm({
  validationSchema: passwordSchema,
  initialValues: {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  },
})

const isSubmitting = ref(false)
const revokeOtherSessions = ref(true)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const onSubmit = form.handleSubmit(async (values) => {
  isSubmitting.value = true
  errorMessage.value = null
  successMessage.value = null

  try {
    await authClient.changePassword(
      {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: revokeOtherSessions.value,
      },
      {
        onSuccess: () => {
          successMessage.value = 'Passwort wurde erfolgreich geändert.'
          form.resetForm()
        },
        onError: (ctx) => {
          if (ctx.error.status === 400) {
            errorMessage.value = 'Aktuelles Passwort ist falsch.'
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
  <Card>
    <CardHeader>
      <div class="flex items-center gap-2">
        <KeyRound class="text-muted-foreground size-5" />
        <CardTitle>Passwort ändern</CardTitle>
      </div>
      <CardDescription>
        Ändern Sie Ihr Passwort. Das neue Passwort muss mindestens 16 Zeichen
        lang sein.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <form @submit="onSubmit">
        <div class="grid gap-4">
          <div
            v-if="errorMessage"
            class="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
          >
            {{ errorMessage }}
          </div>

          <div
            v-if="successMessage"
            class="rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400"
          >
            {{ successMessage }}
          </div>

          <FormField v-slot="{ componentField }" name="currentPassword">
            <FormItem>
              <FormLabel>Aktuelles Passwort</FormLabel>
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

          <FormField v-slot="{ componentField }" name="newPassword">
            <FormItem>
              <FormLabel>Neues Passwort</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="********"
                  autocomplete="new-password"
                  v-bind="componentField"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="confirmPassword">
            <FormItem>
              <FormLabel>Neues Passwort bestätigen</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="********"
                  autocomplete="new-password"
                  v-bind="componentField"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <div class="flex items-center gap-2">
            <Checkbox
              id="revokeOtherSessions"
              v-model:checked="revokeOtherSessions"
            />
            <Label for="revokeOtherSessions" class="cursor-pointer text-sm">
              Andere Sitzungen abmelden
            </Label>
          </div>

          <Button type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? 'Passwort wird geändert...' : 'Passwort ändern' }}
          </Button>
        </div>
      </form>
    </CardContent>
  </Card>
</template>
