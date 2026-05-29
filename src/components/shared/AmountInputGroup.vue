<script setup lang="ts">
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Minus, Plus } from 'lucide-vue-next'

const amount = defineModel<number>('amount', { required: true })
const type = defineModel<'income' | 'expense'>('type', { required: true })

function toggleType() {
  type.value = type.value === 'income' ? 'expense' : 'income'
}
</script>

<template>
  <InputGroup>
    <InputGroupAddon>
      <InputGroupButton
        type="button"
        :class="
          type === 'income'
            ? 'text-lime-600 hover:bg-lime-50 hover:text-lime-700 dark:hover:bg-lime-950'
            : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950'
        "
        @click="toggleType"
      >
        <Plus v-if="type === 'income'" class="size-4" />
        <Minus v-else class="size-4" />
      </InputGroupButton>
    </InputGroupAddon>
    <InputGroupInput
      v-model.number="amount"
      type="number"
      step="0.01"
      min="0"
      placeholder="0,00"
    />
  </InputGroup>
</template>
