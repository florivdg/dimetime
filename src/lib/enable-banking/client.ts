import { requireEnableBankingConfig } from './config'
import { enableBankingAuthHeaders } from './jwt'
import type {
  EbAspspsResponse,
  EbBalancesResponse,
  EbSession,
  EbStartAuthorizationResponse,
  EbTransaction,
  EbTransactionsResponse,
} from './types'

async function ebRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const { baseUrl } = requireEnableBankingConfig()
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`

  const init: RequestInit = {
    method,
    headers: enableBankingAuthHeaders(),
  }
  if (method !== 'GET' && body !== undefined) {
    ;(init.headers as Record<string, string>)['Content-Type'] =
      'application/json'
    init.body = JSON.stringify(body)
  }
  const res = await fetch(url, init)

  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    throw new Error(
      `Enable Banking ${method} ${path} failed (${res.status}): ${errorText}`,
    )
  }

  // DELETE may return empty body
  const text = await res.text()
  if (!text) return {} as T
  return JSON.parse(text) as T
}

export interface ListAspspsParams {
  country?: string
  psuType?: 'personal' | 'business'
  service?: 'AIS' | 'PIS'
}

export async function listAspsps(
  params: ListAspspsParams = {},
): Promise<EbAspspsResponse> {
  const qs = new URLSearchParams()
  if (params.country) qs.set('country', params.country)
  if (params.psuType) qs.set('psu_type', params.psuType)
  if (params.service) qs.set('service', params.service)
  const query = qs.toString()
  return ebRequest<EbAspspsResponse>(
    'GET',
    `/aspsps${query ? `?${query}` : ''}`,
  )
}

export interface StartAuthorizationParams {
  aspspName: string
  aspspCountry: string
  validUntil: string // ISO 8601
  state: string
  redirectUrl: string
  psuType?: 'personal' | 'business'
}

export async function startAuthorization(
  params: StartAuthorizationParams,
): Promise<EbStartAuthorizationResponse> {
  return ebRequest<EbStartAuthorizationResponse>('POST', '/auth', {
    access: { valid_until: params.validUntil },
    aspsp: { name: params.aspspName, country: params.aspspCountry },
    state: params.state,
    redirect_url: params.redirectUrl,
    psu_type: params.psuType ?? 'personal',
  })
}

export async function createSession(code: string): Promise<EbSession> {
  return ebRequest<EbSession>('POST', '/sessions', { code })
}

export async function deleteSession(sessionId: string): Promise<void> {
  await ebRequest<unknown>('DELETE', `/sessions/${sessionId}`)
}

export async function getBalances(
  accountUid: string,
): Promise<EbBalancesResponse> {
  return ebRequest<EbBalancesResponse>(
    'GET',
    `/accounts/${accountUid}/balances`,
  )
}

export interface GetTransactionsParams {
  dateFrom?: string // YYYY-MM-DD
  dateTo?: string // YYYY-MM-DD
  transactionStatus?: 'BOOK' | 'PDNG' | 'BOTH' | 'INFO'
}

const MAX_TRANSACTION_PAGES = 500

export async function getTransactions(
  accountUid: string,
  params: GetTransactionsParams = {},
): Promise<EbTransaction[]> {
  const all: EbTransaction[] = []
  let continuationKey: string | undefined
  let pages = 0

  do {
    if (pages >= MAX_TRANSACTION_PAGES) {
      throw new Error(
        `Enable Banking pagination exceeded ${MAX_TRANSACTION_PAGES} pages for account ${accountUid}`,
      )
    }
    const qs = new URLSearchParams()
    if (params.dateFrom) qs.set('date_from', params.dateFrom)
    if (params.dateTo) qs.set('date_to', params.dateTo)
    if (params.transactionStatus)
      qs.set('transaction_status', params.transactionStatus)
    if (continuationKey) qs.set('continuation_key', continuationKey)
    const query = qs.toString()
    const page = await ebRequest<EbTransactionsResponse>(
      'GET',
      `/accounts/${accountUid}/transactions${query ? `?${query}` : ''}`,
    )
    for (const t of page.transactions) all.push(t)
    continuationKey = page.continuation_key
    pages += 1
  } while (continuationKey)

  return all
}
