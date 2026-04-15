<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Link2, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

interface Aspsp {
  name: string
  country: string
  logo?: string
  beta?: boolean
}

const emit = defineEmits<{
  connected: []
}>()

const open = defineModel<boolean>('open', { default: false })

const country = ref<string>('AT')
const aspsps = ref<Aspsp[]>([])
const selectedAspsp = ref<string>('')
const isLoadingAspsps = ref(false)
const isConnecting = ref(false)

const COUNTRIES = [
  { code: 'AT', name: 'Österreich' },
  { code: 'DE', name: 'Deutschland' },
  { code: 'FI', name: 'Finnland' },
  { code: 'FR', name: 'Frankreich' },
  { code: 'IT', name: 'Italien' },
  { code: 'NL', name: 'Niederlande' },
  { code: 'BE', name: 'Belgien' },
  { code: 'ES', name: 'Spanien' },
  { code: 'SE', name: 'Schweden' },
]

async function loadAspsps() {
  if (!country.value) return
  isLoadingAspsps.value = true
  aspsps.value = []
  selectedAspsp.value = ''
  try {
    const response = await fetch(
      `/api/enable-banking/aspsps?country=${encodeURIComponent(country.value)}&psu_type=personal`,
    )
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error ?? 'Banken konnten nicht geladen werden.')
    }
    const data = await response.json()
    aspsps.value = (data.aspsps ?? []) as Aspsp[]
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : 'Banken konnten nicht geladen werden.',
    )
  } finally {
    isLoadingAspsps.value = false
  }
}

async function handleConnect() {
  if (!selectedAspsp.value || !country.value) return
  isConnecting.value = true
  try {
    const response = await fetch('/api/enable-banking/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aspspName: selectedAspsp.value,
        aspspCountry: country.value,
        psuType: 'personal',
      }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error ?? 'Verbindung konnte nicht gestartet werden.')
    }
    const data = await response.json()
    const popup = window.open(data.redirectUrl, 'enable-banking-auth')
    if (!popup) {
      toast.error(
        'Popup blockiert. Bitte erlaube Popups für diese Seite und versuche es erneut.',
      )
      return
    }
    toast.message('Bitte schließe die Autorisierung im neuen Fenster ab.')
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : 'Verbindung konnte nicht gestartet werden.',
    )
  } finally {
    isConnecting.value = false
  }
}

function handleMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin) return
  if (event.data?.type !== 'enable-banking:callback') return
  if (event.data.ok) {
    toast.success('Bank erfolgreich verbunden.')
    emit('connected')
    open.value = false
  } else {
    toast.error('Autorisierung fehlgeschlagen.')
  }
}

watch(
  open,
  (isOpen) => {
    if (isOpen) {
      loadAspsps()
      window.addEventListener('message', handleMessage)
    } else {
      window.removeEventListener('message', handleMessage)
    }
  },
  { immediate: false },
)

onBeforeUnmount(() => {
  window.removeEventListener('message', handleMessage)
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button variant="default">
        <Link2 class="size-4" />
        Bank verbinden
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Bank verbinden</DialogTitle>
        <DialogDescription>
          Wähle dein Land und deine Bank, um eine sichere Verbindung über Enable
          Banking herzustellen.
        </DialogDescription>
      </DialogHeader>
      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="eb-country">Land</Label>
          <Select v-model="country" @update:model-value="loadAspsps">
            <SelectTrigger id="eb-country">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="c in COUNTRIES" :key="c.code" :value="c.code">
                {{ c.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <Label for="eb-aspsp">Bank</Label>
          <Select v-model="selectedAspsp" :disabled="isLoadingAspsps">
            <SelectTrigger id="eb-aspsp">
              <SelectValue
                :placeholder="
                  isLoadingAspsps ? 'Lädt Banken...' : 'Bank wählen...'
                "
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="aspsp in aspsps"
                :key="`${aspsp.country}-${aspsp.name}`"
                :value="aspsp.name"
              >
                {{ aspsp.name }}
                <span
                  v-if="aspsp.beta"
                  class="text-muted-foreground ml-2 text-xs"
                  >(Beta)</span
                >
              </SelectItem>
            </SelectContent>
          </Select>
          <p
            v-if="!isLoadingAspsps && aspsps.length === 0"
            class="text-muted-foreground text-xs"
          >
            Keine Banken für dieses Land gefunden.
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" @click="open = false">
          Abbrechen
        </Button>
        <Button
          type="button"
          :disabled="!selectedAspsp || isConnecting"
          @click="handleConnect"
        >
          <Loader2 v-if="isConnecting" class="size-4 animate-spin" />
          Weiter zur Bank
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
