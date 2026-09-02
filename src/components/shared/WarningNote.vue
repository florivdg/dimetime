<script setup lang="ts">
import { AlertTriangle } from 'lucide-vue-next'
</script>

<template>
  <div
    class="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2"
  >
    <AlertTriangle class="mt-0.5 size-4 shrink-0 text-amber-500" />
    <p class="text-sm text-amber-700 dark:text-amber-300">
      <slot />
    </p>
  </div>
</template>
