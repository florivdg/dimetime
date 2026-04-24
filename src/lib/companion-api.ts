export const COMPANION_KEY_PREFIX = 'dt_'

export function companionKeyPermissions(): Record<string, string[]> {
  return { bank_transactions: ['write'] }
}
