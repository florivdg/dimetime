import type {
  BankTransactionStatus,
  NormalizedBankTransactionInput,
} from '@/lib/bank-import/types'
import { normalizeCurrency, normalizeText } from '@/lib/bank-import/normalize'
import type { EbAmount, EbTransaction } from './types'

function parseAmountToCents(amount: string): number | null {
  const trimmed = amount.trim()
  if (!trimmed) return null
  const num = Number(trimmed)
  if (!Number.isFinite(num)) return null
  return Math.round(num * 100)
}

function signFromIndicator(
  indicator: EbTransaction['credit_debit_indicator'],
  amountStr?: string,
): 1 | -1 {
  if (indicator === 'CRDT') return 1
  if (indicator === 'DBIT') return -1
  // Fallback: infer sign from the raw amount string when the indicator is missing
  return amountStr?.trimStart().startsWith('-') ? -1 : 1
}

function mapStatus(status: string | undefined): BankTransactionStatus {
  if (status === 'BOOK') return 'booked'
  if (status === 'PDNG') return 'pending'
  return 'unknown'
}

function deriveDescription(t: EbTransaction): string | null {
  const parts = t.remittance_information?.filter(
    (s): s is string => typeof s === 'string' && s.length > 0,
  )
  if (parts && parts.length > 0) return normalizeText(parts.join(' '))
  return normalizeText(t.bank_transaction_code?.description)
}

function derivePurpose(t: EbTransaction): string | null {
  return normalizeText(t.remittance_information?.[0] ?? null)
}

function deriveCounterparty(t: EbTransaction): string | null {
  if (t.credit_debit_indicator === 'CRDT') {
    return (
      normalizeText(t.debtor?.name) ?? normalizeText(t.creditor?.name) ?? null
    )
  }
  return (
    normalizeText(t.creditor?.name) ?? normalizeText(t.debtor?.name) ?? null
  )
}

function toSerializableRawData(
  t: EbTransaction,
): Record<string, string | null> {
  return {
    json: JSON.stringify(t),
  }
}

function externalIdFromTransaction(t: EbTransaction): string | null {
  return (
    normalizeText(t.transaction_id) ??
    normalizeText(t.entry_reference) ??
    normalizeText(t.reference_number) ??
    null
  )
}

function amountToCentsFromAmount(amount: EbAmount | undefined): {
  amountCents: number | null
  currency: string | null
} {
  if (!amount) return { amountCents: null, currency: null }
  const cents = parseAmountToCents(amount.amount)
  return {
    amountCents: cents,
    currency: normalizeCurrency(amount.currency, 'EUR'),
  }
}

export interface MapEbTransactionResult {
  row: NormalizedBankTransactionInput | null
  warning?: string
}

export function mapEbTransaction(t: EbTransaction): MapEbTransactionResult {
  const bookingDate = normalizeText(t.booking_date ?? t.value_date)
  if (!bookingDate) {
    return {
      row: null,
      warning: 'Transaktion ohne Buchungsdatum wurde übersprungen.',
    }
  }

  const rawCents = parseAmountToCents(t.transaction_amount.amount)
  if (rawCents === null) {
    return {
      row: null,
      warning: `Transaktion mit ungültigem Betrag (${t.transaction_amount.amount}) wurde übersprungen.`,
    }
  }
  const sign = signFromIndicator(
    t.credit_debit_indicator,
    t.transaction_amount.amount,
  )
  const amountCents = rawCents * sign
  const currency = normalizeCurrency(t.transaction_amount.currency, 'EUR')

  const original = amountToCentsFromAmount(t.exchange_rate?.instructed_amount)
  const originalAmountCents =
    original.currency && original.currency !== currency
      ? original.amountCents === null
        ? null
        : original.amountCents * sign
      : null
  const originalCurrency =
    original.currency && original.currency !== currency
      ? original.currency
      : null

  const balance = amountToCentsFromAmount(t.balance_after_transaction)

  const row: NormalizedBankTransactionInput = {
    externalTransactionId: externalIdFromTransaction(t),
    bookingDate,
    valueDate: normalizeText(t.value_date),
    amountCents,
    currency,
    originalAmountCents,
    originalCurrency,
    counterparty: deriveCounterparty(t),
    bookingText: normalizeText(t.bank_transaction_code?.description),
    description: deriveDescription(t),
    purpose: derivePurpose(t),
    status: mapStatus(t.status),
    balanceAfterCents: balance.amountCents,
    balanceCurrency: balance.currency,
    country: null,
    cardLast4: null,
    cardholder: null,
    rawData: toSerializableRawData(t),
  }

  return { row }
}

export interface MapEbTransactionsResult {
  rows: NormalizedBankTransactionInput[]
  warnings: string[]
}

export function mapEbTransactions(
  transactions: EbTransaction[],
): MapEbTransactionsResult {
  const rows: NormalizedBankTransactionInput[] = []
  const warnings: string[] = []
  for (const t of transactions) {
    const { row, warning } = mapEbTransaction(t)
    if (warning) warnings.push(warning)
    if (row) rows.push(row)
  }
  return { rows, warnings }
}
