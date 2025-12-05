<script setup lang="ts">
import { Tags } from 'lucide-vue-next'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface TopCategory {
  id: string
  name: string
  color: string | null
  amount: number
  percentage: number
}

defineProps<{
  categories: TopCategory[]
}>()

function formatAmount(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}
</script>

<template>
  <Card>
    <CardHeader class="pb-2">
      <CardDescription>Ausgaben nach Kategorie</CardDescription>
      <CardTitle class="text-2xl">Top-Kategorien</CardTitle>
    </CardHeader>
    <CardContent>
      <div v-if="categories.length > 0" class="space-y-3">
        <div
          v-for="category in categories"
          :key="category.id"
          class="flex items-center gap-3"
        >
          <div
            class="size-3 shrink-0 rounded-full"
            :style="{
              backgroundColor: category.color ?? 'var(--muted-foreground)',
            }"
          />
          <span class="flex-1 truncate text-sm">{{ category.name }}</span>
          <span class="text-muted-foreground text-sm">
            {{ category.percentage }}%
          </span>
          <span class="font-medium">{{ formatAmount(category.amount) }}</span>
        </div>
      </div>
      <div v-else class="text-muted-foreground flex items-center gap-2">
        <Tags class="size-4" />
        <span class="text-sm">Keine Kategorien vorhanden</span>
      </div>
    </CardContent>
  </Card>
</template>
