import { readFileSync } from 'node:fs'

export interface EnableBankingConfig {
  appId: string
  privateKey: string
  baseUrl: string
  audience: string
  redirectUrl: string
  sessionValidityDays: number
}

let cached: EnableBankingConfig | null | undefined

function loadConfig(): EnableBankingConfig | null {
  const appId = process.env.ENABLE_BANKING_APP_ID
  const privateKeyPath = process.env.ENABLE_BANKING_PRIVATE_KEY_PATH
  const redirectUrl = process.env.ENABLE_BANKING_REDIRECT_URL

  if (!appId || !privateKeyPath || !redirectUrl) return null

  let privateKey: string
  try {
    privateKey = readFileSync(privateKeyPath, 'utf8')
  } catch (error) {
    console.error(
      `[enable-banking] Failed to read private key at ${privateKeyPath}:`,
      error,
    )
    return null
  }

  const baseUrl =
    process.env.ENABLE_BANKING_BASE_URL ?? 'https://api.enablebanking.com'
  let audience: string
  try {
    audience = new URL(baseUrl).host
  } catch (error) {
    console.error(
      `[enable-banking] Invalid ENABLE_BANKING_BASE_URL: ${baseUrl}`,
      error,
    )
    return null
  }
  const sessionValidityDaysRaw =
    process.env.ENABLE_BANKING_SESSION_VALIDITY_DAYS
  const sessionValidityDays = sessionValidityDaysRaw
    ? Number(sessionValidityDaysRaw)
    : 90

  return {
    appId,
    privateKey,
    baseUrl,
    audience,
    redirectUrl,
    sessionValidityDays:
      Number.isFinite(sessionValidityDays) && sessionValidityDays > 0
        ? sessionValidityDays
        : 90,
  }
}

export function getEnableBankingConfig(): EnableBankingConfig | null {
  if (cached === undefined) cached = loadConfig()
  return cached
}

export function requireEnableBankingConfig(): EnableBankingConfig {
  const config = getEnableBankingConfig()
  if (!config) {
    throw new Error(
      'Enable Banking ist nicht konfiguriert. Bitte ENABLE_BANKING_APP_ID, ENABLE_BANKING_PRIVATE_KEY_PATH und ENABLE_BANKING_REDIRECT_URL setzen.',
    )
  }
  return config
}

export function isEnableBankingConfigured(): boolean {
  return getEnableBankingConfig() !== null
}

export const EB_STATE_COOKIE = 'eb_oauth_state'
