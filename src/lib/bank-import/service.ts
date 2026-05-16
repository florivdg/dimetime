import { and, eq, inArray, like, or, sql } from 'drizzle-orm'
import { db } from '@/db/database'
import {
  bankTransaction,
  importSource,
  plan,
  statementImport,
} from '@/db/schema/plans'
import type {
  DefaultPlanAssignment,
  ImportFileType,
  ImportTypeDescriptor,
} from '@/lib/bank-import/types'
import { monthFromIsoDate } from '@/lib/bank-import/normalize'
import {
  buildSemanticKey,
  dedupeByStatusUpgrade,
  dedupeRowsInFile,
  hashFileSha256,
} from '@/lib/bank-import/dedupe'
import { notFoundError, validationError } from '@/lib/bank-import/api-helpers'
import { ING_CSV_IMPORT_TYPE, parseIngCsvFile } from './parsers/ing-csv'
import {
  EASYBANK_XLSX_IMPORT_TYPE,
  parseEasybankXlsxFile,
} from './parsers/easybank-xlsx'

const IMPORT_TYPE_DESCRIPTORS: ImportTypeDescriptor[] = [
  ING_CSV_IMPORT_TYPE,
  EASYBANK_XLSX_IMPORT_TYPE,
]

type ImportSourceRow = typeof importSource.$inferSelect

interface ExistingTransactionMatch {
  id: string
  dedupeKey: string
  planId: string | null
  importSeenCount: number
}

interface AssignmentResult {
  planId: string | null
  planAssignment: 'auto_month' | 'none'
}

interface PreparedImportData {
  source: ImportSourceRow
  fileName: string
  fileType: ImportFileType
  fileSha256: string
  parserType: ImportTypeDescriptor
  parsedRows: Awaited<ReturnType<typeof parseIngCsvFile>>['rows']
  uniqueRows: Awaited<ReturnType<typeof dedupeRowsInFile>>['uniqueRows']
  duplicateInFile: number
  assignments: AssignmentResult[]
  existingByDedupeKey: Map<string, ExistingTransactionMatch>
  pendingUpgradeMatches: Map<string, ExistingTransactionMatch>
  warnings: string[]
}

export interface BankImportPreviewResult {
  previewImportId: string
  source: {
    id: string
    name: string
    preset: string
  }
  parser: {
    preset: string
    fileType: ImportFileType
    totalRows: number
  }
  counts: {
    totalRows: number
    rowsAfterFileDedup: number
    duplicateInFile: number
    new: number
    wouldUpdate: number
  }
  assignment: {
    assigned: number
    unassigned: number
  }
  warnings: string[]
  samples: Array<{
    bookingDate: string
    amountCents: number
    currency: string
    status: string
    description: string | null
    counterparty: string | null
    dedupeKey: string
    hasPlanAssignment: boolean
  }>
}

export interface BankImportCommitResult {
  importId: string
  inserted: number
  updated: number
  skipped: number
  assigned: number
  unassigned: number
  warnings: string[]
}

function detectFileType(
  fileName: string,
  mimeType: string,
): ImportFileType | null {
  const lowerName = fileName.toLowerCase()
  if (lowerName.endsWith('.csv')) return 'csv'
  if (lowerName.endsWith('.xlsx')) return 'xlsx'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return 'xlsx'
  }
  if (mimeType.includes('csv')) return 'csv'
  return null
}

function getImportTypeDescriptorByPreset(preset: string): ImportTypeDescriptor {
  const descriptor = IMPORT_TYPE_DESCRIPTORS.find(
    (type) => type.preset === preset,
  )
  if (!descriptor) {
    throw validationError(`Import-Typ wird nicht unterstützt: ${preset}`)
  }
  return descriptor
}

async function parseWithPreset(
  preset: string,
  fileName: string,
  bytes: Uint8Array,
) {
  if (preset === 'ing_csv_v1') {
    return parseIngCsvFile(fileName, bytes)
  }
  if (preset === 'easybank_xlsx_v1') {
    return parseEasybankXlsxFile(fileName, bytes)
  }

  throw validationError(`Kein Parser für Import-Typ ${preset} gefunden.`)
}

function buildPlanLookupWhere(months: string[]) {
  const monthFilters = months.map((month) => like(plan.date, `${month}-%`))
  if (monthFilters.length === 0) return eq(plan.isArchived, false)
  const monthCondition =
    monthFilters.length === 1 ? monthFilters[0] : or(...monthFilters)
  return and(eq(plan.isArchived, false), monthCondition)
}

function groupPlansByMonth(
  plans: { id: string; date: string }[],
): Map<string, string[]> {
  const plansByMonth = new Map<string, string[]>()
  for (const planRow of plans) {
    const month = monthFromIsoDate(planRow.date)
    pushToMap(plansByMonth, month, planRow.id)
  }
  return plansByMonth
}

function pushToMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key)
  if (existing) existing.push(value)
  else map.set(key, [value])
}

async function resolveAssignments(
  bookingDates: string[],
  mode: DefaultPlanAssignment,
): Promise<AssignmentResult[]> {
  if (mode === 'none') {
    return bookingDates.map(() => ({ planId: null, planAssignment: 'none' }))
  }

  const months = Array.from(
    new Set(bookingDates.map((date) => monthFromIsoDate(date))),
  )

  const plans = await db.query.plan.findMany({
    columns: { id: true, date: true },
    where: buildPlanLookupWhere(months),
  })

  const plansByMonth = groupPlansByMonth(plans)

  return bookingDates.map((date) => {
    const monthPlans = plansByMonth.get(monthFromIsoDate(date)) ?? []
    if (monthPlans.length === 1) {
      return { planId: monthPlans[0], planAssignment: 'auto_month' }
    }
    return { planId: null, planAssignment: 'none' }
  })
}

async function getSourceById(sourceId: string): Promise<ImportSourceRow> {
  const source = await db.query.importSource.findFirst({
    where: eq(importSource.id, sourceId),
  })
  if (!source) {
    throw notFoundError('Import-Quelle wurde nicht gefunden.')
  }
  if (!source.isActive) {
    throw validationError('Import-Quelle ist deaktiviert.')
  }
  return source
}

function ensureFileTypeMatchesDescriptor(
  fileName: string,
  file: File,
  descriptor: ImportTypeDescriptor,
): ImportFileType {
  const fileType = detectFileType(fileName, file.type)
  if (!fileType) {
    throw validationError(
      'Dateityp wird nicht unterstützt. Erlaubt sind CSV oder XLSX.',
    )
  }

  const expectedExtensions = descriptor.extensions
  const hasExpectedExtension = expectedExtensions.some((extension) =>
    fileName.toLowerCase().endsWith(extension),
  )
  if (!hasExpectedExtension) {
    throw validationError(
      `Falscher Dateityp für ${descriptor.name}. Erwartet: ${expectedExtensions.join(', ')}.`,
    )
  }
  return fileType
}

async function fetchExistingByDedupeKey(
  sourceId: string,
  dedupeKeys: string[],
): Promise<Map<string, ExistingTransactionMatch>> {
  if (dedupeKeys.length === 0) return new Map()
  const existingRows = await db
    .select({
      id: bankTransaction.id,
      dedupeKey: bankTransaction.dedupeKey,
      planId: bankTransaction.planId,
      importSeenCount: bankTransaction.importSeenCount,
    })
    .from(bankTransaction)
    .where(
      and(
        eq(bankTransaction.sourceId, sourceId),
        inArray(bankTransaction.dedupeKey, dedupeKeys),
      ),
    )
  return new Map(existingRows.map((row) => [row.dedupeKey, row]))
}

type PendingDbRow = {
  id: string
  dedupeKey: string
  planId: string | null
  importSeenCount: number
  bookingDate: string
  amountCents: number
  description: string | null
}

async function fetchPendingDbRows(
  sourceId: string,
  bookingDates: string[],
): Promise<PendingDbRow[]> {
  if (bookingDates.length === 0) return []
  return db
    .select({
      id: bankTransaction.id,
      dedupeKey: bankTransaction.dedupeKey,
      planId: bankTransaction.planId,
      importSeenCount: bankTransaction.importSeenCount,
      bookingDate: bankTransaction.bookingDate,
      amountCents: bankTransaction.amountCents,
      description: bankTransaction.description,
    })
    .from(bankTransaction)
    .where(
      and(
        eq(bankTransaction.sourceId, sourceId),
        eq(bankTransaction.status, 'pending'),
        inArray(bankTransaction.bookingDate, bookingDates),
      ),
    )
}

function groupPendingBySemanticKey(
  pendingDbRows: PendingDbRow[],
): Map<string, PendingDbRow[]> {
  const map = new Map<string, PendingDbRow[]>()
  for (const dbRow of pendingDbRows) {
    pushToMap(map, buildSemanticKey(dbRow), dbRow)
  }
  return map
}

function matchPendingUpgrades(
  unmatchedBookedRows: { dedupeKey: string; bookingDate: string }[],
  pendingDbRows: PendingDbRow[],
): Map<string, ExistingTransactionMatch> {
  const pendingUpgradeMatches = new Map<string, ExistingTransactionMatch>()
  if (pendingDbRows.length === 0) return pendingUpgradeMatches

  const pendingBySemKey = groupPendingBySemanticKey(pendingDbRows)
  const usedDbIds = new Set<string>()

  for (const bookedRow of unmatchedBookedRows) {
    const candidates = pendingBySemKey.get(buildSemanticKey(bookedRow as never))
    if (!candidates) continue
    const match = candidates.find((c) => !usedDbIds.has(c.id))
    if (!match) continue
    usedDbIds.add(match.id)
    pendingUpgradeMatches.set(bookedRow.dedupeKey, {
      id: match.id,
      dedupeKey: match.dedupeKey,
      planId: match.planId,
      importSeenCount: match.importSeenCount,
    })
  }
  return pendingUpgradeMatches
}

async function findPendingUpgradeMatches(
  sourceId: string,
  uniqueRows: PreparedImportData['uniqueRows'],
  existingByDedupeKey: Map<string, ExistingTransactionMatch>,
): Promise<Map<string, ExistingTransactionMatch>> {
  const unmatchedBookedRows = uniqueRows.filter(
    (row) => row.status === 'booked' && !existingByDedupeKey.has(row.dedupeKey),
  )
  if (unmatchedBookedRows.length === 0) return new Map()

  const bookingDatesForLookup = Array.from(
    new Set(unmatchedBookedRows.map((r) => r.bookingDate)),
  )
  const pendingDbRows = await fetchPendingDbRows(
    sourceId,
    bookingDatesForLookup,
  )
  return matchPendingUpgrades(unmatchedBookedRows, pendingDbRows)
}

function buildImportWarnings(
  parsed: { warnings: string[] },
  assignments: AssignmentResult[],
  pendingUpgradeMatches: Map<string, ExistingTransactionMatch>,
): string[] {
  const warnings = [...parsed.warnings]
  const unassignedCount = assignments.filter((a) => !a.planId).length
  if (unassignedCount > 0) {
    warnings.push(
      `${unassignedCount} Transaktionen konnten keinem eindeutigen Monatsplan zugeordnet werden.`,
    )
  }
  if (pendingUpgradeMatches.size > 0) {
    warnings.push(
      `${pendingUpgradeMatches.size} ausstehende Transaktionen werden auf 'Gebucht' aktualisiert.`,
    )
  }
  return warnings
}

async function prepareImportData(
  sourceId: string,
  file: File,
): Promise<PreparedImportData> {
  const source = await getSourceById(sourceId)
  const descriptor = getImportTypeDescriptorByPreset(source.preset)
  const fileName = file.name || 'upload'
  const fileType = ensureFileTypeMatchesDescriptor(fileName, file, descriptor)

  const bytes = new Uint8Array(await file.arrayBuffer())
  const fileSha256 = await hashFileSha256(bytes)
  const parsed = await parseWithPreset(source.preset, fileName, bytes)
  const { rows: statusDedupedRows, pendingDropped } = dedupeByStatusUpgrade(
    parsed.rows,
  )
  const { uniqueRows, duplicateInFile: rawDuplicateInFile } =
    await dedupeRowsInFile(statusDedupedRows)
  const duplicateInFile = rawDuplicateInFile + pendingDropped
  const assignments = await resolveAssignments(
    uniqueRows.map((row) => row.bookingDate),
    source.defaultPlanAssignment as DefaultPlanAssignment,
  )

  const existingByDedupeKey = await fetchExistingByDedupeKey(
    source.id,
    uniqueRows.map((row) => row.dedupeKey),
  )
  const pendingUpgradeMatches = await findPendingUpgradeMatches(
    source.id,
    uniqueRows,
    existingByDedupeKey,
  )

  return {
    source,
    fileName,
    fileType,
    fileSha256,
    parserType: descriptor,
    parsedRows: parsed.rows,
    uniqueRows,
    duplicateInFile,
    assignments,
    existingByDedupeKey,
    pendingUpgradeMatches,
    warnings: buildImportWarnings(parsed, assignments, pendingUpgradeMatches),
  }
}

async function logFailedImport(input: {
  sourceId: string
  fileName: string
  fileType: ImportFileType
  fileSha256: string
  phase: 'preview' | 'commit'
  errorMessage: string
  triggeredByUserId?: string | null
}) {
  await db.insert(statementImport).values({
    sourceId: input.sourceId,
    fileName: input.fileName,
    fileSha256: input.fileSha256,
    fileType: input.fileType,
    phase: input.phase,
    status: 'failed',
    previewCount: 0,
    importedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    errorMessage: input.errorMessage,
    triggeredByUserId: input.triggeredByUserId ?? null,
    createdAt: new Date(),
  })
}

export function getImportTypes(): ImportTypeDescriptor[] {
  return IMPORT_TYPE_DESCRIPTORS
}

function computePreviewCounts(preparedData: PreparedImportData) {
  const dedupeKeyMatches = preparedData.uniqueRows.filter((row) =>
    preparedData.existingByDedupeKey.has(row.dedupeKey),
  ).length
  const wouldUpdate = dedupeKeyMatches + preparedData.pendingUpgradeMatches.size
  const newCount = preparedData.uniqueRows.length - wouldUpdate
  const assigned = preparedData.assignments.filter((a) => a.planId).length
  const unassigned = preparedData.assignments.length - assigned
  return { wouldUpdate, newCount, assigned, unassigned }
}

function buildPreviewSamples(preparedData: PreparedImportData) {
  return preparedData.uniqueRows.slice(0, 10).map((row, index) => ({
    bookingDate: row.bookingDate,
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status,
    description: row.description,
    counterparty: row.counterparty,
    dedupeKey: row.dedupeKey,
    hasPlanAssignment: Boolean(preparedData.assignments[index]?.planId),
  }))
}

async function insertPreviewLog(
  preparedData: PreparedImportData,
  triggeredByUserId: string | null,
): Promise<string> {
  const [previewLog] = await db
    .insert(statementImport)
    .values({
      sourceId: preparedData.source.id,
      fileName: preparedData.fileName,
      fileSha256: preparedData.fileSha256,
      fileType: preparedData.fileType,
      phase: 'preview',
      status: 'success',
      previewCount: preparedData.parsedRows.length,
      importedCount: 0,
      updatedCount: 0,
      skippedCount: preparedData.duplicateInFile,
      errorMessage: null,
      triggeredByUserId,
      createdAt: new Date(),
    })
    .returning({ id: statementImport.id })
  return previewLog.id
}

function errorMessageOr(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export async function previewBankImport(input: {
  sourceId: string
  file: File
  triggeredByUserId?: string | null
}): Promise<BankImportPreviewResult> {
  let prepared: PreparedImportData | null = null

  try {
    const preparedData = await prepareImportData(input.sourceId, input.file)
    prepared = preparedData

    const counts = computePreviewCounts(preparedData)
    const previewImportId = await insertPreviewLog(
      preparedData,
      input.triggeredByUserId ?? null,
    )

    return {
      previewImportId,
      source: {
        id: preparedData.source.id,
        name: preparedData.source.name,
        preset: preparedData.source.preset,
      },
      parser: {
        preset: preparedData.source.preset,
        fileType: preparedData.fileType,
        totalRows: preparedData.parsedRows.length,
      },
      counts: {
        totalRows: preparedData.parsedRows.length,
        rowsAfterFileDedup: preparedData.uniqueRows.length,
        duplicateInFile: preparedData.duplicateInFile,
        new: counts.newCount,
        wouldUpdate: counts.wouldUpdate,
      },
      assignment: {
        assigned: counts.assigned,
        unassigned: counts.unassigned,
      },
      warnings: preparedData.warnings,
      samples: buildPreviewSamples(preparedData),
    }
  } catch (error) {
    if (prepared) {
      await logFailedImport({
        sourceId: prepared.source.id,
        fileName: prepared.fileName,
        fileType: prepared.fileType,
        fileSha256: prepared.fileSha256,
        phase: 'preview',
        errorMessage: errorMessageOr(
          error,
          'Unbekannter Fehler bei der Vorschau',
        ),
        triggeredByUserId: input.triggeredByUserId ?? null,
      })
    }
    throw error
  }
}

type UniqueRow = PreparedImportData['uniqueRows'][number]

type PendingUpgradeRow = {
  row: UniqueRow
  assignment: AssignmentResult
  existingDbRow: ExistingTransactionMatch
}

interface CommitCounts {
  assigned: number
  unassigned: number
  insertedCount: number
  updatedCount: number
}

interface CommitContext {
  preparedData: PreparedImportData
  importId: string
  now: Date
}

interface Partition {
  allRows: BuiltRowValues[]
  pendingUpgradeRows: PendingUpgradeRow[]
  counts: CommitCounts
}

function buildRowFields(row: UniqueRow, ctx: CommitContext) {
  return {
    sourceId: ctx.preparedData.source.id,
    firstSeenImportId: ctx.importId,
    lastSeenImportId: ctx.importId,
    externalTransactionId: row.externalTransactionId,
    dedupeKey: row.dedupeKey,
    bookingDate: row.bookingDate,
    valueDate: row.valueDate,
    amountCents: row.amountCents,
    currency: row.currency,
    originalAmountCents: row.originalAmountCents,
    originalCurrency: row.originalCurrency,
    counterparty: row.counterparty,
    bookingText: row.bookingText,
    description: row.description,
    purpose: row.purpose,
    status: row.status,
    balanceAfterCents: row.balanceAfterCents,
    balanceCurrency: row.balanceCurrency,
    country: row.country,
    cardLast4: row.cardLast4,
    cardholder: row.cardholder,
    rawDataJson: JSON.stringify(row.rawData),
    createdAt: ctx.now,
    updatedAt: ctx.now,
  }
}

function buildExistingRowValues(
  row: UniqueRow,
  existing: ExistingTransactionMatch,
  assignment: AssignmentResult,
  ctx: CommitContext,
) {
  const shouldAssignPlan = !existing.planId && Boolean(assignment.planId)
  const planId = shouldAssignPlan ? assignment.planId : existing.planId
  return {
    ...buildRowFields(row, ctx),
    id: existing.id,
    planId,
    planAssignment:
      shouldAssignPlan && assignment.planAssignment === 'auto_month'
        ? ('auto_month' as const)
        : ('none' as const),
    importSeenCount: existing.importSeenCount + 1,
  }
}

function buildNewRowValues(
  row: UniqueRow,
  assignment: AssignmentResult,
  ctx: CommitContext,
) {
  return {
    ...buildRowFields(row, ctx),
    planId: assignment.planId,
    planAssignment: assignment.planAssignment,
    importSeenCount: 1,
  }
}

type BuiltRowValues = ReturnType<typeof buildExistingRowValues>

function bumpAssignedCounts(counts: CommitCounts, hasPlan: boolean): void {
  if (hasPlan) counts.assigned += 1
  else counts.unassigned += 1
}

function classifyRow(
  row: UniqueRow,
  assignment: AssignmentResult,
  ctx: CommitContext,
  partition: Partition,
): BuiltRowValues | null {
  const { preparedData } = ctx
  const { counts, pendingUpgradeRows } = partition

  const pendingUpgrade = preparedData.pendingUpgradeMatches.get(row.dedupeKey)
  if (pendingUpgrade) {
    counts.updatedCount += 1
    bumpAssignedCounts(
      counts,
      Boolean(pendingUpgrade.planId || assignment.planId),
    )
    pendingUpgradeRows.push({ row, assignment, existingDbRow: pendingUpgrade })
    return null
  }

  const existing = preparedData.existingByDedupeKey.get(row.dedupeKey)
  if (existing) {
    counts.updatedCount += 1
    const values = buildExistingRowValues(row, existing, assignment, ctx)
    bumpAssignedCounts(counts, Boolean(values.planId))
    return values
  }

  counts.insertedCount += 1
  bumpAssignedCounts(counts, Boolean(assignment.planId))
  return buildNewRowValues(row, assignment, ctx) as BuiltRowValues
}

function partitionRows(ctx: CommitContext): Partition {
  const partition: Partition = {
    allRows: [],
    pendingUpgradeRows: [],
    counts: { assigned: 0, unassigned: 0, insertedCount: 0, updatedCount: 0 },
  }
  ctx.preparedData.uniqueRows.forEach((row, index) => {
    const values = classifyRow(
      row,
      ctx.preparedData.assignments[index],
      ctx,
      partition,
    )
    if (values !== null) partition.allRows.push(values)
  })
  return partition
}

function buildUpsertSet() {
  const cols = bankTransaction
  return {
    externalTransactionId: sql.raw(
      `excluded.${cols.externalTransactionId.name}`,
    ),
    bookingDate: sql.raw(`excluded.${cols.bookingDate.name}`),
    valueDate: sql.raw(`excluded.${cols.valueDate.name}`),
    amountCents: sql.raw(`excluded.${cols.amountCents.name}`),
    currency: sql.raw(`excluded.${cols.currency.name}`),
    originalAmountCents: sql.raw(`excluded.${cols.originalAmountCents.name}`),
    originalCurrency: sql.raw(`excluded.${cols.originalCurrency.name}`),
    counterparty: sql.raw(`excluded.${cols.counterparty.name}`),
    bookingText: sql.raw(`excluded.${cols.bookingText.name}`),
    description: sql.raw(`excluded.${cols.description.name}`),
    purpose: sql.raw(`excluded.${cols.purpose.name}`),
    status: sql.raw(`excluded.${cols.status.name}`),
    balanceAfterCents: sql.raw(`excluded.${cols.balanceAfterCents.name}`),
    balanceCurrency: sql.raw(`excluded.${cols.balanceCurrency.name}`),
    country: sql.raw(`excluded.${cols.country.name}`),
    cardLast4: sql.raw(`excluded.${cols.cardLast4.name}`),
    cardholder: sql.raw(`excluded.${cols.cardholder.name}`),
    rawDataJson: sql.raw(`excluded.${cols.rawDataJson.name}`),
    lastSeenImportId: sql.raw(`excluded.${cols.lastSeenImportId.name}`),
    importSeenCount: sql.raw(
      `"bank_transaction"."${cols.importSeenCount.name}" + 1`,
    ),
    planAssignment: sql.raw(
      `CASE WHEN "bank_transaction"."${cols.planAssignment.name}" = 'manual' OR "bank_transaction"."${cols.planId.name}" IS NOT NULL THEN "bank_transaction"."${cols.planAssignment.name}" ELSE excluded."${cols.planAssignment.name}" END`,
    ),
    planId: sql.raw(
      `CASE WHEN "bank_transaction"."${cols.planAssignment.name}" = 'manual' OR "bank_transaction"."${cols.planId.name}" IS NOT NULL THEN "bank_transaction"."${cols.planId.name}" ELSE excluded."${cols.planId.name}" END`,
    ),
    updatedAt: sql.raw(`excluded.${cols.updatedAt.name}`),
  }
}

async function applyCommit(
  ctx: CommitContext,
  partition: Partition,
  triggeredByUserId: string | null,
): Promise<void> {
  const { preparedData, importId, now } = ctx
  const { allRows, pendingUpgradeRows, counts } = partition

  await db.transaction(async (tx) => {
    await tx.insert(statementImport).values({
      id: importId,
      sourceId: preparedData.source.id,
      fileName: preparedData.fileName,
      fileSha256: preparedData.fileSha256,
      fileType: preparedData.fileType,
      phase: 'commit',
      status: 'success',
      previewCount: preparedData.parsedRows.length,
      importedCount: counts.insertedCount,
      updatedCount: counts.updatedCount,
      skippedCount: preparedData.duplicateInFile,
      errorMessage: null,
      triggeredByUserId,
      createdAt: now,
    })

    for (const upgrade of pendingUpgradeRows) {
      const { row, existingDbRow } = upgrade
      await tx
        .update(bankTransaction)
        .set({
          dedupeKey: row.dedupeKey,
          externalTransactionId: row.externalTransactionId,
          status: 'booked',
          valueDate: row.valueDate,
          purpose: row.purpose,
          bookingText: row.bookingText,
          rawDataJson: JSON.stringify(row.rawData),
          lastSeenImportId: importId,
          importSeenCount: existingDbRow.importSeenCount + 1,
          isArchived: false,
          updatedAt: now,
        })
        .where(eq(bankTransaction.id, existingDbRow.id))
    }

    if (allRows.length === 0) return
    await tx
      .insert(bankTransaction)
      .values(allRows)
      .onConflictDoUpdate({
        target: [bankTransaction.sourceId, bankTransaction.dedupeKey],
        set: buildUpsertSet(),
      })
  })
}

export async function commitBankImport(input: {
  sourceId: string
  file: File
  triggeredByUserId?: string | null
}): Promise<BankImportCommitResult> {
  let prepared: PreparedImportData | null = null

  try {
    const preparedData = await prepareImportData(input.sourceId, input.file)
    prepared = preparedData
    const ctx: CommitContext = {
      preparedData,
      importId: crypto.randomUUID(),
      now: new Date(),
    }
    const partition = partitionRows(ctx)
    await applyCommit(ctx, partition, input.triggeredByUserId ?? null)

    return {
      importId: ctx.importId,
      inserted: partition.counts.insertedCount,
      updated: partition.counts.updatedCount,
      skipped: preparedData.duplicateInFile,
      assigned: partition.counts.assigned,
      unassigned: partition.counts.unassigned,
      warnings: preparedData.warnings,
    }
  } catch (error) {
    if (prepared) {
      await logFailedImport({
        sourceId: prepared.source.id,
        fileName: prepared.fileName,
        fileType: prepared.fileType,
        fileSha256: prepared.fileSha256,
        phase: 'commit',
        errorMessage: errorMessageOr(error, 'Unbekannter Fehler beim Import'),
        triggeredByUserId: input.triggeredByUserId ?? null,
      })
    }
    throw error
  }
}
