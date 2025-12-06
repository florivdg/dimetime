<script setup lang="ts">
import { computed } from 'vue'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Check, AlertCircle, Users } from 'lucide-vue-next'
import type { UserBasic } from '@/lib/users'
import type { ImportSummary, UserMapping } from '@/lib/import'

const props = defineProps<{
  summary: ImportSummary
  systemUsers: UserBasic[]
  modelValue: UserMapping
}>()

const emit = defineEmits<{
  'update:modelValue': [mapping: UserMapping]
}>()

const allMapped = computed(() => {
  return props.summary.uniqueImportedUserIds.every((id) => props.modelValue[id])
})

const mappedCount = computed(() => {
  return props.summary.uniqueImportedUserIds.filter(
    (id) => props.modelValue[id],
  ).length
})

function updateMapping(importedUserId: string, systemUserId: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    [importedUserId]: systemUserId,
  })
}

function formatUserId(id: string): string {
  return `${id.substring(0, 8)}...`
}
</script>

<template>
  <div class="space-y-6">
    <!-- Summary Card -->
    <Card>
      <CardHeader>
        <CardTitle>Import-Übersicht</CardTitle>
        <CardDescription>
          Diese Daten werden nach dem Import in das System übertragen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div class="bg-muted/50 rounded-lg p-3">
            <dt class="text-muted-foreground text-sm">Pläne</dt>
            <dd class="text-2xl font-semibold">{{ summary.plansCount }}</dd>
          </div>
          <div class="bg-muted/50 rounded-lg p-3">
            <dt class="text-muted-foreground text-sm">Transaktionen</dt>
            <dd class="text-2xl font-semibold">
              {{ summary.transactionsCount }}
            </dd>
          </div>
          <div class="bg-muted/50 rounded-lg p-3">
            <dt class="text-muted-foreground text-sm">Benutzer</dt>
            <dd class="text-2xl font-semibold">
              {{ summary.uniqueImportedUserIds.length }}
            </dd>
          </div>
          <div class="bg-muted/50 rounded-lg p-3">
            <dt class="text-muted-foreground text-sm">Zeitraum</dt>
            <dd v-if="summary.dateRange" class="text-sm font-medium">
              {{ summary.dateRange.from }}<br />
              bis {{ summary.dateRange.to }}
            </dd>
            <dd v-else class="text-muted-foreground text-sm">-</dd>
          </div>
        </dl>
      </CardContent>
    </Card>

    <!-- User Mapping Card -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Users class="size-5" />
          Benutzer zuordnen
        </CardTitle>
        <CardDescription>
          Ordne die importierten Benutzer-IDs den bestehenden Benutzern im
          System zu.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <!-- Status -->
        <div
          class="flex items-center gap-2 rounded-lg p-3"
          :class="{
            'bg-lime-500/10 text-lime-700 dark:text-lime-400': allMapped,
            'bg-amber-500/10 text-amber-700 dark:text-amber-400': !allMapped,
          }"
        >
          <Check v-if="allMapped" class="size-5" />
          <AlertCircle v-else class="size-5" />
          <span v-if="allMapped">Alle Benutzer zugeordnet</span>
          <span v-else>
            {{ mappedCount }} von
            {{ summary.uniqueImportedUserIds.length }} Benutzern zugeordnet
          </span>
        </div>

        <!-- Mapping List -->
        <div class="space-y-3">
          <div
            v-for="userId in summary.uniqueImportedUserIds"
            :key="userId"
            class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
          >
            <div class="flex-1">
              <Label class="text-muted-foreground mb-1 block text-xs">
                Importierte ID
              </Label>
              <code
                class="bg-muted inline-block rounded px-2 py-1 font-mono text-sm"
              >
                {{ formatUserId(userId) }}
              </code>
            </div>
            <div class="text-muted-foreground hidden sm:block">→</div>
            <div class="flex-1">
              <Label class="text-muted-foreground mb-1 block text-xs">
                System-Benutzer
              </Label>
              <Select
                :model-value="modelValue[userId] || ''"
                @update:model-value="
                  (val) => val && updateMapping(userId, String(val))
                "
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="Benutzer auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="user in systemUsers"
                    :key="user.id"
                    :value="user.id"
                  >
                    {{ user.name }} ({{ user.email }})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <!-- No Users Warning -->
        <div
          v-if="systemUsers.length === 0"
          class="bg-destructive/10 text-destructive rounded-lg p-4"
        >
          <p class="font-medium">Keine Benutzer im System gefunden</p>
          <p class="text-sm opacity-80">
            Es müssen zuerst Benutzer im System angelegt werden, bevor Daten
            importiert werden können.
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
