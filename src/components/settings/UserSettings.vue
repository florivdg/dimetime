<script setup lang="ts">
import { ref } from 'vue'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Settings } from 'lucide-vue-next'
import type { UserSettings } from '@/lib/settings'

interface Props {
  initialSettings: UserSettings
}

const props = defineProps<Props>()

const isSaving = ref(false)
const errorMessage = ref<string | null>(null)
const settings = ref<UserSettings>({ ...props.initialSettings })

async function updateSetting<K extends keyof UserSettings>(
  key: K,
  value: UserSettings[K],
) {
  isSaving.value = true
  errorMessage.value = null

  const oldValue = settings.value[key]
  settings.value[key] = value

  try {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    })

    if (!response.ok) {
      throw new Error('Fehler beim Speichern')
    }

    settings.value = await response.json()
  } catch {
    settings.value[key] = oldValue
    errorMessage.value = 'Einstellung konnte nicht gespeichert werden.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Settings class="size-5" />
        Transaktionen
      </CardTitle>
      <CardDescription>
        Anpassungen zur Darstellung von Transaktionen.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div
        v-if="errorMessage"
        class="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
      >
        {{ errorMessage }}
      </div>

      <div v-else class="space-y-6">
        <div class="flex items-center justify-between gap-4">
          <div class="space-y-0.5">
            <Label for="groupByType" class="text-base">
              Transaktionen nach Typ gruppieren
            </Label>
            <p class="text-muted-foreground text-sm">
              Bei Sortierung nach Betrag werden Einnahmen und Ausgaben getrennt
              sortiert.
            </p>
          </div>
          <Switch
            id="groupByType"
            :model-value="settings.groupTransactionsByType"
            :disabled="isSaving"
            @update:model-value="
              updateSetting('groupTransactionsByType', $event)
            "
          />
        </div>
      </div>
    </CardContent>
  </Card>
</template>
