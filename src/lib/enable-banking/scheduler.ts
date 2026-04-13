import { isEnableBankingConfigured } from './config'
import { syncAllEnableBankingSources } from './service'

const STARTED_KEY = Symbol.for('dimetime.enableBanking.cronStarted')

async function runOnce() {
  try {
    const result = await syncAllEnableBankingSources()
    const failures = result.results.filter((r) => !r.ok)
    console.log(
      `[enable-banking] Scheduled sync completed: ${result.results.length} sources, ${failures.length} failures`,
    )
  } catch (error) {
    console.error('[enable-banking] Scheduled sync crashed:', error)
  }
}

export function startEnableBankingScheduler() {
  const g = globalThis as Record<symbol, boolean>
  if (g[STARTED_KEY]) return
  if (!isEnableBankingConfigured()) return

  g[STARTED_KEY] = true
  Bun.cron('@daily', runOnce)
  console.log('[enable-banking] Daily sync cron scheduled (@daily UTC)')
  console.log('[enable-banking] Running initial sync')
  void runOnce()
}
