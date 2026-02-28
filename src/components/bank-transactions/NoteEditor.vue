<script setup lang="ts">
import { ref, watch } from 'vue'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { StickyNote } from 'lucide-vue-next'

const props = defineProps<{
  note: string | null
  transactionId: string
}>()

const emit = defineEmits<{
  'update:note': [transactionId: string, note: string | null]
}>()

const open = ref(false)
const draft = ref(props.note ?? '')

watch(
  () => props.note,
  (val) => {
    if (!open.value) {
      draft.value = val ?? ''
    }
  },
)

watch(open, (isOpen) => {
  if (isOpen) {
    draft.value = props.note ?? ''
  } else {
    const trimmed = draft.value.trim()
    const newNote = trimmed.length > 0 ? trimmed : null
    if (newNote !== props.note) {
      emit('update:note', props.transactionId, newNote)
    }
  }
})
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="icon"
        class="size-8"
        :class="
          note
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-muted-foreground opacity-0 group-hover/row:opacity-100'
        "
      >
        <StickyNote class="size-4" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-72" align="start">
      <Textarea
        v-model="draft"
        placeholder="Notiz eingeben..."
        class="min-h-[80px] resize-none"
        :maxlength="2000"
        @keydown.meta.enter="open = false"
        @keydown.ctrl.enter="open = false"
      />
    </PopoverContent>
  </Popover>
</template>
