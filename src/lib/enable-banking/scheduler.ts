import { isEnableBankingConfigured } from './config'
import { syncAllEnableBankingSources } from './service'

const DAY_MS = 24 * 60 * 60 * 1000
const INITIAL_KICK_MS = 60 * 1000

type SchedulerState = {
  started: boolean
  interval: ReturnType<typeof setInterval> | null
  initialTimeout: ReturnType<typeof setTimeout> | null
}

const globalKey = Symbol.for('dimetime.enableBanking.scheduler')
type GlobalWithScheduler = typeof globalThis & {
  [globalKey]?: SchedulerState
}

function getState(): SchedulerState {
  const g = globalThis as GlobalWithScheduler
  if (!g[globalKey]) {
    g[globalKey] = { started: false, interval: null, initialTimeout: null }
  }
  return g[globalKey]
}

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
  const state = getState()
  if (state.started) return
  if (!isEnableBankingConfigured()) return

  state.started = true
  state.initialTimeout = setTimeout(runOnce, INITIAL_KICK_MS)
  state.interval = setInterval(runOnce, DAY_MS)
  console.log('[enable-banking] Daily sync scheduler started')
}

export function stopEnableBankingScheduler() {
  const state = getState()
  if (state.interval) clearInterval(state.interval)
  if (state.initialTimeout) clearTimeout(state.initialTimeout)
  state.interval = null
  state.initialTimeout = null
  state.started = false
}
