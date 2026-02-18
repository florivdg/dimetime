<script setup lang="ts">
import type { BankImportPreviewResult } from '@/lib/bank-import/service'
import { formatAmount, formatDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CalendarDays } from 'lucide-vue-next'

defineProps<{
  preview: BankImportPreviewResult
}>()
</script>

<template>
  <div class="space-y-4">
    <!-- Summary counts — 2 rows of 3 for reliable fit -->
    <div class="grid grid-cols-3 gap-2">
      <div class="bg-muted rounded-md px-3 py-2 text-center">
        <p class="text-lg leading-tight font-bold">
          {{ preview.counts.totalRows }}
        </p>
        <p class="text-muted-foreground text-[11px]">Zeilen</p>
      </div>
      <div class="bg-muted rounded-md px-3 py-2 text-center">
        <p
          class="text-lg leading-tight font-bold text-lime-600 dark:text-lime-400"
        >
          {{ preview.counts.new }}
        </p>
        <p class="text-muted-foreground text-[11px]">Neu</p>
      </div>
      <div class="bg-muted rounded-md px-3 py-2 text-center">
        <p class="text-lg leading-tight font-bold">
          {{ preview.counts.wouldUpdate }}
        </p>
        <p class="text-muted-foreground text-[11px]">Aktualisierung</p>
      </div>
      <div class="bg-muted rounded-md px-3 py-2 text-center">
        <p class="text-lg leading-tight font-bold">
          {{ preview.counts.duplicateInFile }}
        </p>
        <p class="text-muted-foreground text-[11px]">Duplikat</p>
      </div>
      <div class="bg-muted rounded-md px-3 py-2 text-center">
        <p class="text-lg leading-tight font-bold">
          {{ preview.assignment.assigned }}
        </p>
        <p class="text-muted-foreground text-[11px]">Plan zugeordnet</p>
      </div>
      <div class="bg-muted rounded-md px-3 py-2 text-center">
        <p class="text-lg leading-tight font-bold">
          {{ preview.assignment.unassigned }}
        </p>
        <p class="text-muted-foreground text-[11px]">Ohne Plan</p>
      </div>
    </div>

    <!-- Warnings -->
    <div
      v-if="preview.warnings.length > 0"
      class="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2"
    >
      <AlertTriangle class="mt-0.5 size-4 shrink-0 text-amber-500" />
      <div class="space-y-0.5">
        <p
          v-for="(warning, i) in preview.warnings"
          :key="i"
          class="text-sm text-amber-700 dark:text-amber-300"
        >
          {{ warning }}
        </p>
      </div>
    </div>

    <!-- Sample transactions -->
    <div v-if="preview.samples.length > 0">
      <p class="text-muted-foreground mb-1.5 text-xs font-medium">
        Vorschau ({{ preview.samples.length }} von
        {{ preview.counts.totalRows }} Zeilen)
      </p>
      <div class="overflow-x-auto rounded-md border">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b">
              <th
                class="text-muted-foreground px-3 py-2 text-left text-xs font-medium whitespace-nowrap"
              >
                Datum
              </th>
              <th
                class="text-muted-foreground px-3 py-2 text-left text-xs font-medium"
              >
                Beschreibung
              </th>
              <th
                class="text-muted-foreground px-3 py-2 text-right text-xs font-medium whitespace-nowrap"
              >
                Betrag
              </th>
              <th
                class="text-muted-foreground px-3 py-2 text-center text-xs font-medium"
              >
                Status
              </th>
              <th
                class="text-muted-foreground px-3 py-2 text-center text-xs font-medium"
              >
                Plan
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(sample, i) in preview.samples"
              :key="i"
              class="border-b last:border-0"
            >
              <td class="px-3 py-1.5 text-xs whitespace-nowrap">
                {{ formatDate(sample.bookingDate, 'short') }}
              </td>
              <td class="max-w-[260px] truncate px-3 py-1.5">
                <span v-if="sample.counterparty" class="text-xs font-medium">{{
                  sample.counterparty
                }}</span>
                <span
                  v-else-if="sample.description"
                  class="text-muted-foreground text-xs"
                  >{{ sample.description }}</span
                >
              </td>
              <td class="px-3 py-1.5 text-right text-xs whitespace-nowrap">
                <span
                  :class="
                    sample.amountCents >= 0
                      ? 'text-lime-600 dark:text-lime-400'
                      : 'text-rose-600 dark:text-rose-400'
                  "
                >
                  {{ formatAmount(sample.amountCents) }}
                </span>
              </td>
              <td class="px-3 py-1.5 text-center">
                <Badge variant="outline" class="px-1.5 py-0 text-[10px]">
                  {{
                    sample.status === 'booked'
                      ? 'Gebucht'
                      : sample.status === 'pending'
                        ? 'Ausstehend'
                        : '?'
                  }}
                </Badge>
              </td>
              <td class="px-3 py-1.5 text-center">
                <CalendarDays
                  v-if="sample.hasPlanAssignment"
                  class="mx-auto size-3.5 text-lime-600"
                />
                <span v-else class="text-muted-foreground text-xs">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
