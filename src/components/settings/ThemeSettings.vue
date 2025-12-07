<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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
import { Palette } from 'lucide-vue-next'
import type { ThemePreference, UserSettings } from '@/lib/settings'
import type { AcceptableValue } from 'reka-ui'

interface Props {
  initialSettings: UserSettings
}

const props = defineProps<Props>()

const { store: colorModeStore } = useColorMode()

const isSaving = ref(false)
const errorMessage = ref<string | null>(null)
const isMounted = ref(false)

// Use initial settings during SSR, then switch to reactive colorModeStore after mount
// This prevents hydration mismatch since useColorMode() defaults to 'auto'
const displayValue = computed(() => {
  if (!isMounted.value) {
    return apiToLocal(props.initialSettings.themePreference)
  }
  return colorModeStore.value
})

// Map between API values and vueuse-color-scheme values
// API: 'light' | 'dark' | 'system'
// vueuse: 'light' | 'dark' | 'auto'
function apiToLocal(value: ThemePreference): 'light' | 'dark' | 'auto' {
  return value === 'system' ? 'auto' : value
}

function localToApi(value: string): ThemePreference {
  return value === 'auto' ? 'system' : (value as ThemePreference)
}

onMounted(() => {
  // Sync server preference to local useColorMode store on mount
  if (props.initialSettings.themePreference) {
    colorModeStore.value = apiToLocal(props.initialSettings.themePreference)
  }
  isMounted.value = true
})

async function updateTheme(value: AcceptableValue) {
  if (typeof value !== 'string') return

  isSaving.value = true
  errorMessage.value = null

  const oldValue = colorModeStore.value
  colorModeStore.value = value as 'light' | 'dark' | 'auto'

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
      <div
        v-if="errorMessage"
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
            :model-value="displayValue"
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
