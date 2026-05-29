<script setup lang="ts">
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

defineProps<{ total: number; itemsPerPage: number; page: number }>()
defineEmits<{ 'update:page': [page: number] }>()
</script>

<template>
  <Pagination
    :total="total"
    :sibling-count="1"
    :items-per-page="itemsPerPage"
    :page="page"
    show-edges
    @update:page="(p: number) => $emit('update:page', p)"
  >
    <PaginationContent v-slot="{ items }">
      <PaginationFirst />
      <PaginationPrevious />
      <template v-for="(item, index) in items">
        <PaginationItem
          v-if="item.type === 'page'"
          :key="index"
          :value="item.value"
          :is-active="item.value === page"
        >
          {{ item.value }}
        </PaginationItem>
        <PaginationEllipsis v-else :key="item.type" :index="index" />
      </template>
      <PaginationNext />
      <PaginationLast />
    </PaginationContent>
  </Pagination>
</template>
