<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Check, Copy } from 'lucide-vue-next'

defineProps<{
  codes: string[]
  warningText: string
}>()

const copiedIndex = ref<number | null>(null)

async function copyOne(code: string, index: number) {
  await navigator.clipboard.writeText(code)
  copiedIndex.value = index
  setTimeout(() => {
    copiedIndex.value = null
  }, 2000)
}

async function copyAll(codes: string[]) {
  await navigator.clipboard.writeText(codes.join('\n'))
  copiedIndex.value = -1
  setTimeout(() => {
    copiedIndex.value = null
  }, 2000)
}
</script>

<template>
  <div class="space-y-4">
    <div
      class="rounded-md border bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200"
    >
      <strong>Wichtig:</strong> {{ warningText }}
    </div>
    <div class="grid grid-cols-2 gap-2">
      <div
        v-for="(code, index) in codes"
        :key="code"
        class="bg-muted flex items-center justify-between rounded px-3 py-2"
      >
        <code class="text-sm">{{ code }}</code>
        <Button
          size="icon"
          variant="ghost"
          class="size-6"
          @click="copyOne(code, index)"
        >
          <Check v-if="copiedIndex === index" class="size-3" />
          <Copy v-else class="size-3" />
        </Button>
      </div>
    </div>
    <Button variant="outline" class="w-full" @click="copyAll(codes)">
      <Check v-if="copiedIndex === -1" class="size-4" />
      <Copy v-else class="size-4" />
      Alle Codes kopieren
    </Button>
    <slot />
  </div>
</template>
