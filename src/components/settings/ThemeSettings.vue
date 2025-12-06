<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useColorMode } from '@vueuse/core'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Loader2, Palette } from 'lucide-vue-next'
import type { ThemePreference } from '@/lib/settings'

const { store: colorModeStore } = useColorMode()

const isLoading = ref(true)
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

// Map between API values and vueuse-color-scheme values
// API: 'light' | 'dark' | 'system'
// vueuse: 'light' | 'dark' | 'auto'
function apiToLocal(value: ThemePreference): string {
  return value === 'system' ? 'auto' : value
}

function localToApi(value: string): ThemePreference {
  return value === 'auto' ? 'system' : (value as ThemePreference)
}

onMounted(async () => {
  await loadSettings()
})

async function loadSettings() {
  isLoading.value = true
  errorMessage.value = null
  try {
    const response = await fetch('/api/settings')
    if (!response.ok) throw new Error('Fehler beim Laden')
    const settings = await response.json()
    // Sync server preference to local useColorMode store
    if (settings.themePreference) {
      colorModeStore.value = apiToLocal(settings.themePreference)
    }
  } catch {
    errorMessage.value = 'Einstellungen konnten nicht geladen werden.'
  } finally {
    isLoading.value = false
  }
}

async function updateTheme(value: string) {
  isSaving.value = true
  errorMessage.value = null

  const oldValue = colorModeStore.value
  colorModeStore.value = value

  try {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themePreference: localToApi(value) }),
    })

    if (!response.ok) {
      throw new Error('Fehler beim Speichern')
    }
  } catch {
    colorModeStore.value = oldValue
    errorMessage.value = 'Einstellung konnte nicht gespeichert werden.'
  } finally {
    isSaving.value = false
  }
}

const themeOptions = [
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
  { value: 'auto', label: 'System' },
]
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Palette class="size-5" />
        Erscheinungsbild
      </CardTitle>
      <CardDescription>
        Wähle zwischen hellem und dunklem Erscheinungsbild.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Loader2 class="text-muted-foreground size-6 animate-spin" />
      </div>

      <div
        v-else-if="errorMessage"
        class="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
      >
        {{ errorMessage }}
      </div>

      <div v-else class="space-y-6">
        <div class="flex items-center justify-between gap-4">
          <div class="space-y-0.5">
            <Label for="theme-select" class="text-base"> Farbschema </Label>
            <p class="text-muted-foreground text-sm">
              Passe das Erscheinungsbild der Anwendung an.
            </p>
          </div>
          <Select
            :model-value="colorModeStore"
            :disabled="isSaving"
            @update:model-value="updateTheme"
          >
            <SelectTrigger id="theme-select" class="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in themeOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
