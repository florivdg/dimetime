import type { ImportSource } from '@/lib/bank-transactions'

export function hasActiveEnableBankingConnection(
  source: ImportSource,
): boolean {
  return Boolean(
    source.connectionType === 'enable_banking' &&
    source.enableBankingSessionId &&
    source.enableBankingAccountUid,
  )
}
