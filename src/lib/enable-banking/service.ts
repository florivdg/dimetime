import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@/db/database'
import { enableBankingSession, importSource } from '@/db/schema/plans'
import {
  getSourceById,
  prepareFromRows,
  upsertBankTransactionRows,
  type BankImportCommitResult,
} from '@/lib/bank-import/service'
import { hashFileSha256 } from '@/lib/bank-import/dedupe'
import { ImportApiError, validationError } from '@/lib/bank-import/api-helpers'
import {
  createSession,
  deleteSession as deleteSessionApi,
  getTransactions,
  listAspsps as listAspspsApi,
  startAuthorization,
  type ListAspspsParams,
} from './client'
import { getEnableBankingConfig, requireEnableBankingConfig } from './config'
import { mapEbTransactions } from './map-transaction'
import type { EbAccountResource, EbAspspsResponse, EbSession } from './types'

type ImportSourceRow = typeof importSource.$inferSelect
type EnableBankingSessionRow = typeof enableBankingSession.$inferSelect

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function classifySourceKind(
  account: EbAccountResource,
): 'bank_account' | 'credit_card' | 'other' {
  const cat = account.cash_account_type?.toUpperCase()
  if (cat === 'CARD') return 'credit_card'
  if (cat === 'CACC' || cat === 'SVGS' || cat === 'CASH') return 'bank_account'
  return 'other'
}

function accountLabel(account: EbAccountResource): string {
  return (
    account.name ??
    account.details ??
    account.product ??
    account.account_id?.iban ??
    account.uid
  )
}

function accountIdentifier(account: EbAccountResource): string {
  return account.account_id?.iban ?? account.uid
}

function sourceDisplayName(aspspName: string, account: EbAccountResource) {
  const label = account.name ?? account.details ?? account.product
  return label ? `${aspspName} – ${label}` : aspspName
}

export async function listAspsps(
  params: ListAspspsParams,
): Promise<EbAspspsResponse> {
  requireEnableBankingConfig()
  return listAspspsApi(params)
}

export interface StartConnectInput {
  aspspName: string
  aspspCountry: string
  psuType?: 'personal' | 'business'
  state: string
}

export async function startConnect(
  input: StartConnectInput,
): Promise<{ redirectUrl: string; authorizationId: string }> {
  const config = requireEnableBankingConfig()
  const validUntil = new Date(
    Date.now() + config.sessionValidityDays * 24 * 60 * 60 * 1000,
  ).toISOString()
  const response = await startAuthorization({
    aspspName: input.aspspName,
    aspspCountry: input.aspspCountry,
    validUntil,
    state: input.state,
    redirectUrl: config.redirectUrl,
    psuType: input.psuType ?? 'personal',
  })
  return {
    redirectUrl: response.url,
    authorizationId: response.authorization_id,
  }
}

export interface CompleteConnectResult {
  sessionRowId: string
  sessionId: string
  aspsp: { name: string; country: string }
  sources: Array<{
    id: string
    name: string
    accountIdentifier: string | null
  }>
}

export async function completeConnect(
  code: string,
): Promise<CompleteConnectResult> {
  requireEnableBankingConfig()
  const ebSession = await createSession(code)
  const now = new Date()
  const validUntil = new Date(ebSession.access.valid_until)

  const [sessionRow] = await db
    .insert(enableBankingSession)
    .values({
      sessionId: ebSession.session_id,
      aspspName: ebSession.aspsp.name,
      aspspCountry: ebSession.aspsp.country,
      psuType: ebSession.psu_type === 'business' ? 'business' : 'personal',
      validUntil,
      rawSessionJson: JSON.stringify(ebSession),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  const linked = await linkAccountsToSources(ebSession, sessionRow.id)

  return {
    sessionRowId: sessionRow.id,
    sessionId: ebSession.session_id,
    aspsp: ebSession.aspsp,
    sources: linked.map((s) => ({
      id: s.id,
      name: s.name,
      accountIdentifier: s.accountIdentifier,
    })),
  }
}

async function linkAccountsToSources(
  ebSession: EbSession,
  sessionRowId: string,
): Promise<ImportSourceRow[]> {
  const now = new Date()
  const linked: ImportSourceRow[] = []

  for (const account of ebSession.accounts) {
    // Try to find an existing source by any of the identification hashes
    const hashCandidates = Array.from(
      new Set(
        [
          account.identification_hash,
          ...(account.identification_hashes ?? []),
        ].filter((h): h is string => typeof h === 'string' && h.length > 0),
      ),
    )

    const existing =
      hashCandidates.length === 0
        ? null
        : await db.query.importSource.findFirst({
            where: and(
              eq(importSource.connectionType, 'enable_banking'),
              inArray(
                importSource.enableBankingIdentificationHash,
                hashCandidates,
              ),
            ),
          })

    if (existing) {
      const [updated] = await db
        .update(importSource)
        .set({
          enableBankingAccountUid: account.uid,
          enableBankingSessionId: sessionRowId,
          enableBankingIdentificationHash: account.identification_hash,
          bankName: ebSession.aspsp.name,
          accountLabel: accountLabel(account),
          accountIdentifier: accountIdentifier(account),
          lastSyncError: null,
          isActive: true,
          updatedAt: now,
        })
        .where(eq(importSource.id, existing.id))
        .returning()
      linked.push(updated)
    } else {
      const [inserted] = await db
        .insert(importSource)
        .values({
          name: sourceDisplayName(ebSession.aspsp.name, account),
          preset: 'enable_banking_v1',
          sourceKind: classifySourceKind(account),
          connectionType: 'enable_banking',
          bankName: ebSession.aspsp.name,
          accountLabel: accountLabel(account),
          accountIdentifier: accountIdentifier(account),
          defaultPlanAssignment: 'auto_month',
          enableBankingAccountUid: account.uid,
          enableBankingIdentificationHash: account.identification_hash,
          enableBankingSessionId: sessionRowId,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
      linked.push(inserted)
    }
  }

  return linked
}

async function loadSessionForSource(
  source: ImportSourceRow,
): Promise<EnableBankingSessionRow | null> {
  if (!source.enableBankingSessionId) return null
  const row = await db.query.enableBankingSession.findFirst({
    where: eq(enableBankingSession.id, source.enableBankingSessionId),
  })
  return row ?? null
}

async function loadSourcesForSession(
  sessionRowId: string,
): Promise<ImportSourceRow[]> {
  return db.query.importSource.findMany({
    where: eq(importSource.enableBankingSessionId, sessionRowId),
  })
}

function computeDateFrom(source: ImportSourceRow): string {
  if (!source.lastSyncAt) return isoDaysAgo(90)
  const lastSync = new Date(source.lastSyncAt)
  const overlap = new Date(lastSync.getTime() - 7 * 24 * 60 * 60 * 1000)
  return overlap.toISOString().slice(0, 10)
}

export interface SyncSourceResult extends BankImportCommitResult {
  sourceId: string
  sourceName: string
  fetchedCount: number
}

export async function syncSource(
  sourceOrId: string | ImportSourceRow,
  options: { triggeredByUserId?: string | null } = {},
): Promise<SyncSourceResult> {
  requireEnableBankingConfig()
  const source =
    typeof sourceOrId === 'string'
      ? await getSourceById(sourceOrId)
      : sourceOrId
  if (source.connectionType !== 'enable_banking') {
    throw validationError(
      'Diese Quelle ist nicht mit Enable Banking verknüpft.',
    )
  }
  if (!source.enableBankingAccountUid) {
    throw validationError(
      'Für diese Quelle ist kein verknüpftes Konto hinterlegt.',
    )
  }

  const sessionRow = await loadSessionForSource(source)
  if (!sessionRow) {
    await markSourceSyncError(
      source.id,
      'Keine Enable-Banking-Session verknüpft.',
    )
    throw validationError('Keine aktive Enable-Banking-Session verknüpft.')
  }
  if (sessionRow.status !== 'active') {
    await markSourceSyncError(
      source.id,
      'Enable-Banking-Session ist abgelaufen oder widerrufen.',
    )
    throw validationError(
      'Enable-Banking-Session ist abgelaufen oder widerrufen. Bitte Bank erneut verbinden.',
    )
  }
  if (sessionRow.validUntil && sessionRow.validUntil < new Date()) {
    await db
      .update(enableBankingSession)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(enableBankingSession.id, sessionRow.id))
    await markSourceSyncError(
      source.id,
      'Enable-Banking-Session ist abgelaufen.',
    )
    throw validationError(
      'Enable-Banking-Session ist abgelaufen. Bitte Bank erneut verbinden.',
    )
  }

  const dateFrom = computeDateFrom(source)
  let transactions
  try {
    transactions = await getTransactions(source.enableBankingAccountUid, {
      dateFrom,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unbekannter Fehler beim Abruf der Transaktionen.'
    await markSourceSyncError(source.id, message)
    throw error
  }

  const { rows, warnings: mapWarnings } = mapEbTransactions(transactions)
  const now = new Date()
  const payloadHash = await hashFileSha256(
    new TextEncoder().encode(JSON.stringify(transactions)),
  )
  const fileName = `enable_banking:${sessionRow.aspspName}:${now.toISOString()}`

  const prepared = await prepareFromRows({
    source,
    rawRows: rows,
    totalRowCount: transactions.length,
    fileName,
    fileType: 'api',
    fileSha256: payloadHash,
    parserWarnings: mapWarnings,
  })

  const commitResult = await upsertBankTransactionRows(
    prepared,
    options.triggeredByUserId,
  )

  await db
    .update(importSource)
    .set({ lastSyncAt: now, lastSyncError: null, updatedAt: now })
    .where(eq(importSource.id, source.id))

  return {
    ...commitResult,
    sourceId: source.id,
    sourceName: source.name,
    fetchedCount: transactions.length,
  }
}

async function markSourceSyncError(sourceId: string, message: string) {
  await db
    .update(importSource)
    .set({ lastSyncError: message, updatedAt: new Date() })
    .where(eq(importSource.id, sourceId))
}

export interface SyncAllResult {
  results: Array<{
    sourceId: string
    sourceName: string
    ok: boolean
    inserted?: number
    updated?: number
    skipped?: number
    fetchedCount?: number
    error?: string
  }>
}

export async function syncAllEnableBankingSources(
  options: {
    triggeredByUserId?: string | null
  } = {},
): Promise<SyncAllResult> {
  if (!getEnableBankingConfig()) {
    return { results: [] }
  }
  const sources = await db.query.importSource.findMany({
    where: and(
      eq(importSource.connectionType, 'enable_banking'),
      eq(importSource.isActive, true),
      isNotNull(importSource.enableBankingAccountUid),
      isNotNull(importSource.enableBankingSessionId),
    ),
  })

  const results: SyncAllResult['results'] = []
  for (const source of sources) {
    try {
      const res = await syncSource(source, {
        triggeredByUserId: options.triggeredByUserId,
      })
      results.push({
        sourceId: source.id,
        sourceName: source.name,
        ok: true,
        inserted: res.inserted,
        updated: res.updated,
        skipped: res.skipped,
        fetchedCount: res.fetchedCount,
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unbekannter Fehler beim Synchronisieren.'
      console.error(
        `[enable-banking] Sync failed for source ${source.id}:`,
        error,
      )
      results.push({
        sourceId: source.id,
        sourceName: source.name,
        ok: false,
        error: message,
      })
    }
  }
  return { results }
}

export interface DisconnectSourceResult {
  disconnectedCount: number
}

export async function disconnectSource(
  sourceId: string,
): Promise<DisconnectSourceResult> {
  requireEnableBankingConfig()
  const source = await getSourceById(sourceId)
  if (source.connectionType !== 'enable_banking') {
    throw validationError(
      'Diese Quelle ist nicht mit Enable Banking verknüpft.',
    )
  }
  const sessionRow = await loadSessionForSource(source)
  const linkedSourceIds = sessionRow
    ? (await loadSourcesForSession(sessionRow.id)).map((row) => row.id)
    : []
  const sourceIdsToDisconnect =
    linkedSourceIds.length > 0 ? linkedSourceIds : [source.id]

  if (sessionRow?.status === 'active') {
    try {
      await deleteSessionApi(sessionRow.sessionId)
    } catch (error) {
      console.error(
        `[enable-banking] Failed to delete session ${sessionRow.sessionId} on remote:`,
        error,
      )
      throw new ImportApiError(
        502,
        'Bankverbindung konnte bei Enable Banking nicht getrennt werden. Bitte erneut versuchen.',
      )
    }
  }

  await db.transaction(async (tx) => {
    if (sessionRow?.status === 'active') {
      await tx
        .update(enableBankingSession)
        .set({ status: 'revoked', updatedAt: new Date() })
        .where(eq(enableBankingSession.id, sessionRow.id))
    }

    await tx
      .update(importSource)
      .set({
        enableBankingAccountUid: null,
        enableBankingSessionId: null,
        lastSyncError: null,
        updatedAt: new Date(),
      })
      .where(inArray(importSource.id, sourceIdsToDisconnect))
  })

  return { disconnectedCount: sourceIdsToDisconnect.length }
}
