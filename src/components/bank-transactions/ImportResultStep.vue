<script setup lang="ts">
import type { BankImportCommitResult } from '@/lib/bank-import/service'
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-vue-next'

defineProps<{
  result: BankImportCommitResult | null
  isLoading: boolean
  error: string | null
}>()
</script>

<template>
  <!-- Loading -->
  <div v-if="isLoading" class="flex flex-col items-center gap-3 py-8">
    <Loader2 class="text-muted-foreground size-8 animate-spin" />
    <p class="text-muted-foreground">Import wird durchgeführt...</p>
  </div>

  <!-- Error -->
  <div v-else-if="error" class="flex flex-col items-center gap-3 py-8">
    <XCircle class="text-destructive size-12" />
    <p class="text-destructive text-center font-medium">{{ error }}</p>
  </div>

  <!-- Success -->
  <div v-else-if="result" class="space-y-4">
    <div class="flex flex-col items-center gap-1.5 py-3">
      <CheckCircle2 class="size-10 text-lime-500" />
      <p class="font-medium">Import erfolgreich</p>
    </div>

    <div class="grid grid-cols-3 gap-2">
      <div class="bg-muted rounded-md px-3 py-2 text-center">
        <p
          class="text-lg leading-tight font-bold text-lime-600 dark:text-lime-400"
        >
          {{ result.inserted }}
        </p>
        <p class="text-muted-foreground text-[11px]">Eingefügt</p>
      </div>
      <div class="bg-muted rounded-md px-3 py-2 text-center">
        <p class="text-lg leading-tight font-bold">{{ result.updated }}</p>
        <p class="text-muted-foreground text-[11px]">Aktualisiert</p>
      </div>
      <div class="bg-muted rounded-md px-3 py-2 text-center">
        <p class="text-lg leading-tight font-bold">{{ result.skipped }}</p>
        <p class="text-muted-foreground text-[11px]">Übersprungen</p>
      </div>
      <div class="col-span-3 grid grid-cols-2 gap-2">
        <div class="bg-muted rounded-md px-3 py-2 text-center">
          <p class="text-lg leading-tight font-bold">{{ result.assigned }}</p>
          <p class="text-muted-foreground text-[11px]">Plan zugeordnet</p>
        </div>
        <div class="bg-muted rounded-md px-3 py-2 text-center">
          <p class="text-lg leading-tight font-bold">{{ result.unassigned }}</p>
          <p class="text-muted-foreground text-[11px]">Ohne Plan</p>
        </div>
      </div>
    </div>

    <!-- Warnings -->
    <div
      v-if="result.warnings.length > 0"
      class="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2"
    >
      <AlertTriangle class="mt-0.5 size-4 shrink-0 text-amber-500" />
      <div class="space-y-0.5">
        <p
          v-for="(warning, i) in result.warnings"
          :key="i"
          class="text-sm text-amber-700 dark:text-amber-300"
        >
          {{ warning }}
        </p>
      </div>
    </div>
  </div>
</template>
