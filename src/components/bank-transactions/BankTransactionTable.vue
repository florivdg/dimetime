<script setup lang="ts">
import type { BankTransactionWithRelations } from '@/lib/bank-transactions'
import { formatAmount, formatDate, getPlanDisplayName } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Landmark,
  Loader2,
  Search,
} from 'lucide-vue-next'

const props = defineProps<{
  transactions: BankTransactionWithRelations[]
  isLoading: boolean
  searchQuery: string
  sortBy: 'bookingDate' | 'amountCents' | 'createdAt'
  sortDir: 'asc' | 'desc'
  hasActiveFilters: boolean
}>()

const emit = defineEmits<{
  sort: [column: 'bookingDate' | 'amountCents' | 'createdAt']
}>()

function getSortIcon(column: 'bookingDate' | 'amountCents' | 'createdAt') {
  if (props.sortBy !== column) return ArrowUpDown
  return props.sortDir === 'asc' ? ArrowUp : ArrowDown
}

function statusLabel(status: string): string {
  if (status === 'booked') return 'Gebucht'
  if (status === 'pending') return 'Ausstehend'
  return 'Unbekannt'
}

function statusVariant(
  status: string,
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'booked') return 'default'
  if (status === 'pending') return 'secondary'
  return 'outline'
}
</script>

<template>
  <!-- Loading -->
  <div v-if="isLoading" class="flex items-center justify-center py-8">
    <Loader2 class="text-muted-foreground size-6 animate-spin" />
  </div>

  <!-- Empty state -->
  <div
    v-else-if="transactions.length === 0 && !searchQuery && !hasActiveFilters"
    class="py-8 text-center"
  >
    <Landmark class="text-muted-foreground mx-auto mb-4 size-12" />
    <p class="text-muted-foreground">Keine Kontoauszüge vorhanden.</p>
    <p class="text-muted-foreground mt-1 text-sm">
      Importiere Bankdaten über den Import-Button.
    </p>
  </div>

  <!-- No results -->
  <div v-else-if="transactions.length === 0" class="py-8 text-center">
    <Search class="text-muted-foreground mx-auto mb-4 size-12" />
    <p class="text-muted-foreground">Keine Transaktionen gefunden.</p>
  </div>

  <!-- Table -->
  <div v-else class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-36">
            <Button
              variant="ghost"
              size="sm"
              class="-ml-3"
              @click="emit('sort', 'bookingDate')"
            >
              Datum
              <component :is="getSortIcon('bookingDate')" class="ml-2 size-4" />
            </Button>
          </TableHead>
          <TableHead>Beschreibung</TableHead>
          <TableHead class="w-36">
            <Button
              variant="ghost"
              size="sm"
              class="-ml-3"
              @click="emit('sort', 'amountCents')"
            >
              Betrag
              <component :is="getSortIcon('amountCents')" class="ml-2 size-4" />
            </Button>
          </TableHead>
          <TableHead>Quelle</TableHead>
          <TableHead class="w-28">Status</TableHead>
          <TableHead>Plan</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="tx in transactions" :key="tx.id">
          <!-- Date -->
          <TableCell>{{ formatDate(tx.bookingDate) }}</TableCell>

          <!-- Description -->
          <TableCell>
            <div>
              <span v-if="tx.counterparty" class="font-medium">{{
                tx.counterparty
              }}</span>
              <p
                v-if="tx.description"
                class="text-muted-foreground truncate text-sm"
              >
                {{ tx.description }}
              </p>
            </div>
          </TableCell>

          <!-- Amount -->
          <TableCell>
            <span
              :class="
                tx.amountCents >= 0
                  ? 'text-lime-600 dark:text-lime-400'
                  : 'text-rose-600 dark:text-rose-400'
              "
            >
              {{ formatAmount(tx.amountCents) }}
            </span>
          </TableCell>

          <!-- Source -->
          <TableCell>
            <span class="text-muted-foreground text-sm">{{
              tx.sourceName || '-'
            }}</span>
          </TableCell>

          <!-- Status -->
          <TableCell>
            <Badge :variant="statusVariant(tx.status)">
              {{ statusLabel(tx.status) }}
            </Badge>
          </TableCell>

          <!-- Plan -->
          <TableCell>
            <a
              v-if="tx.planId"
              :href="`/plans/${tx.planId}`"
              class="text-sm hover:underline"
            >
              {{ getPlanDisplayName(tx.planName, tx.planDate) }}
            </a>
            <span v-else class="text-muted-foreground">-</span>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
