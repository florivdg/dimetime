<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CheckCircle, XCircle, Loader2, RotateCcw } from 'lucide-vue-next'
import type { ImportResult } from '@/lib/import'

defineProps<{
  result: ImportResult | null
  isLoading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  reset: []
}>()
</script>

<template>
  <!-- Loading State -->
  <Card v-if="isLoading">
    <CardContent class="flex flex-col items-center justify-center py-12">
      <Loader2 class="size-12 animate-spin text-lime-500" />
      <p class="text-muted-foreground mt-4 text-lg">
        Import wird durchgeführt...
      </p>
      <p class="text-muted-foreground mt-2 text-sm">
        Dies kann je nach Datenmenge einen Moment dauern.
      </p>
    </CardContent>
  </Card>

  <!-- Error State -->
  <Card v-else-if="error" class="border-destructive">
    <CardHeader>
      <CardTitle class="text-destructive flex items-center gap-2">
        <XCircle class="size-6" />
        Import fehlgeschlagen
      </CardTitle>
      <CardDescription>
        Beim Import ist ein Fehler aufgetreten.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="bg-destructive/10 text-destructive rounded-lg p-4">
        <p class="font-mono text-sm">{{ error }}</p>
      </div>
      <Button variant="outline" @click="emit('reset')">
        <RotateCcw class="mr-2 size-4" />
        Erneut versuchen
      </Button>
    </CardContent>
  </Card>

  <!-- Success State -->
  <Card v-else-if="result">
    <CardHeader>
      <CardTitle
        class="flex items-center gap-2 text-lime-600 dark:text-lime-400"
      >
        <CheckCircle class="size-6" />
        Import abgeschlossen
      </CardTitle>
      <CardDescription>
        Die Daten wurden erfolgreich importiert.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-6">
      <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div class="rounded-lg bg-lime-500/10 p-4">
          <dt class="text-muted-foreground text-sm">Pläne importiert</dt>
          <dd class="text-2xl font-semibold text-lime-600 dark:text-lime-400">
            {{ result.plansImported }}
          </dd>
        </div>
        <div class="bg-muted/50 rounded-lg p-4">
          <dt class="text-muted-foreground text-sm">Pläne übersprungen</dt>
          <dd class="text-muted-foreground text-2xl font-semibold">
            {{ result.plansSkipped }}
          </dd>
        </div>
        <div class="rounded-lg bg-lime-500/10 p-4">
          <dt class="text-muted-foreground text-sm">
            Transaktionen importiert
          </dt>
          <dd class="text-2xl font-semibold text-lime-600 dark:text-lime-400">
            {{ result.transactionsImported }}
          </dd>
        </div>
        <div class="bg-muted/50 rounded-lg p-4">
          <dt class="text-muted-foreground text-sm">
            Transaktionen übersprungen
          </dt>
          <dd class="text-muted-foreground text-2xl font-semibold">
            {{ result.transactionsSkipped }}
          </dd>
        </div>
      </dl>

      <div
        v-if="result.plansSkipped > 0 || result.transactionsSkipped > 0"
        class="rounded-lg bg-amber-500/10 p-4 text-amber-700 dark:text-amber-400"
      >
        <p class="text-sm">
          <strong>Hinweis:</strong> Übersprungene Einträge existierten bereits
          im System (gleiche ID).
        </p>
      </div>

      <div class="flex gap-3">
        <Button @click="emit('reset')">
          <RotateCcw class="mr-2 size-4" />
          Neuen Import starten
        </Button>
        <Button variant="outline" as="a" href="/plans"> Zu den Plänen </Button>
      </div>
    </CardContent>
  </Card>
</template>
