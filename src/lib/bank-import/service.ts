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
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))
    return 'xlsx'
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
  const monthFilters = months.map((month) => like(plan.date, `${month}-%`))
  const whereClause =
    monthFilters.length === 0
      ? eq(plan.isArchived, false)
      : and(
          eq(plan.isArchived, false),
          monthFilters.length === 1 ? monthFilters[0] : or(...monthFilters),
        )

  const plans = await db.query.plan.findMany({
    columns: { id: true, date: true },
    where: whereClause,
  })

  const plansByMonth = new Map<string, string[]>()
  for (const planRow of plans) {
    const month = monthFromIsoDate(planRow.date)
    const existing = plansByMonth.get(month)
    if (existing) {
      existing.push(planRow.id)
    } else {
      plansByMonth.set(month, [planRow.id])
    }
  }

  return bookingDates.map((date) => {
    const month = monthFromIsoDate(date)
    const monthPlans = plansByMonth.get(month) ?? []
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

async function prepareImportData(
  sourceId: string,
  file: File,
): Promise<PreparedImportData> {
  const source = await getSourceById(sourceId)
  const descriptor = getImportTypeDescriptorByPreset(source.preset)
  const fileName = file.name || 'upload'
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

  const dedupeKeys = uniqueRows.map((row) => row.dedupeKey)
  const existingRows =
    dedupeKeys.length === 0
      ? []
      : await db
          .select({
            id: bankTransaction.id,
            dedupeKey: bankTransaction.dedupeKey,
            planId: bankTransaction.planId,
            importSeenCount: bankTransaction.importSeenCount,
          })
          .from(bankTransaction)
          .where(
            and(
              eq(bankTransaction.sourceId, source.id),
              inArray(bankTransaction.dedupeKey, dedupeKeys),
            ),
          )

  const existingByDedupeKey = new Map(
    existingRows.map((row) => [
      row.dedupeKey,
      {
        id: row.id,
        dedupeKey: row.dedupeKey,
        planId: row.planId,
        importSeenCount: row.importSeenCount,
      },
    ]),
  )

  // Cross-import: find pending DB rows that match unmatched booked import rows
  const unmatchedBookedRows = uniqueRows.filter(
    (row) => row.status === 'booked' && !existingByDedupeKey.has(row.dedupeKey),
  )
  const pendingUpgradeMatches = new Map<string, ExistingTransactionMatch>()

  if (unmatchedBookedRows.length > 0) {
    const bookingDatesForLookup = Array.from(
      new Set(unmatchedBookedRows.map((r) => r.bookingDate)),
    )
    const pendingDbRows = await db
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
          eq(bankTransaction.sourceId, source.id),
          eq(bankTransaction.status, 'pending'),
          inArray(bankTransaction.bookingDate, bookingDatesForLookup),
        ),
      )

    if (pendingDbRows.length > 0) {
      // Group pending DB rows by semantic key
      const pendingDbBySemanticKey = new Map<string, typeof pendingDbRows>()
      for (const dbRow of pendingDbRows) {
        const semKey = buildSemanticKey(dbRow)
        const group = pendingDbBySemanticKey.get(semKey)
        if (group) {
          group.push(dbRow)
        } else {
          pendingDbBySemanticKey.set(semKey, [dbRow])
        }
      }

      // One-for-one matching
      const usedDbIds = new Set<string>()
      for (const bookedRow of unmatchedBookedRows) {
        const semKey = buildSemanticKey(bookedRow)
        const candidates = pendingDbBySemanticKey.get(semKey)
        if (!candidates) continue
        const match = candidates.find((c) => !usedDbIds.has(c.id))
        if (match) {
          usedDbIds.add(match.id)
          pendingUpgradeMatches.set(bookedRow.dedupeKey, {
            id: match.id,
            dedupeKey: match.dedupeKey,
            planId: match.planId,
            importSeenCount: match.importSeenCount,
          })
        }
      }
    }
  }

  const warnings = [...parsed.warnings]
  const unassignedCount = assignments.filter(
    (assignment) => !assignment.planId,
  ).length
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
    warnings,
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

export async function previewBankImport(input: {
  sourceId: string
  file: File
  triggeredByUserId?: string | null
}): Promise<BankImportPreviewResult> {
  let prepared: PreparedImportData | null = null

  try {
    const preparedData = await prepareImportData(input.sourceId, input.file)
    prepared = preparedData

    const dedupeKeyMatches = preparedData.uniqueRows.filter((row) =>
      preparedData.existingByDedupeKey.has(row.dedupeKey),
    ).length
    const wouldUpdate =
      dedupeKeyMatches + preparedData.pendingUpgradeMatches.size
    const newCount = preparedData.uniqueRows.length - wouldUpdate
    const assigned = preparedData.assignments.filter(
      (assignment) => assignment.planId,
    ).length
    const unassigned = preparedData.assignments.length - assigned

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
        triggeredByUserId: input.triggeredByUserId ?? null,
        createdAt: new Date(),
      })
      .returning({ id: statementImport.id })

    return {
      previewImportId: previewLog.id,
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
        new: newCount,
        wouldUpdate,
      },
      assignment: {
        assigned,
        unassigned,
      },
      warnings: preparedData.warnings,
      samples: preparedData.uniqueRows.slice(0, 10).map((row, index) => ({
        bookingDate: row.bookingDate,
        amountCents: row.amountCents,
        currency: row.currency,
        status: row.status,
        description: row.description,
        counterparty: row.counterparty,
        dedupeKey: row.dedupeKey,
        hasPlanAssignment: Boolean(preparedData.assignments[index]?.planId),
      })),
    }
  } catch (error) {
    if (prepared) {
      await logFailedImport({
        sourceId: prepared.source.id,
        fileName: prepared.fileName,
        fileType: prepared.fileType,
        fileSha256: prepared.fileSha256,
        phase: 'preview',
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Unbekannter Fehler bei der Vorschau',
        triggeredByUserId: input.triggeredByUserId ?? null,
      })
    }
    throw error
  }
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
    const importId = crypto.randomUUID()
    const now = new Date()

    let assigned = 0
    let unassigned = 0
    let insertedCount = 0
    let updatedCount = 0

    // Collect pending upgrade rows to handle separately
    const pendingUpgradeRows: Array<{
      row: (typeof preparedData.uniqueRows)[number]
      assignment: AssignmentResult
      existingDbRow: NonNullable<
        ReturnType<typeof preparedData.pendingUpgradeMatches.get>
      >
    }> = []

    const allRows = preparedData.uniqueRows
      .map((row, index) => {
        const assignment = preparedData.assignments[index]
        const existing = preparedData.existingByDedupeKey.get(row.dedupeKey)

        // Check for pending upgrade match
        const pendingUpgrade = preparedData.pendingUpgradeMatches.get(
          row.dedupeKey,
        )
        if (pendingUpgrade) {
          updatedCount += 1
          if (pendingUpgrade.planId || assignment.planId) assigned += 1
          else unassigned += 1
          pendingUpgradeRows.push({
            row,
            assignment,
            existingDbRow: pendingUpgrade,
          })
          return null // exclude from main upsert
        }

        if (existing) {
          updatedCount += 1
          const shouldAssignPlan =
            !existing.planId && Boolean(assignment.planId)
          const planId = shouldAssignPlan ? assignment.planId : existing.planId
          if (planId) assigned += 1
          else unassigned += 1

          return {
            id: existing.id,
            sourceId: preparedData.source.id,
            firstSeenImportId: importId, // ignored on conflict via SQL override
            lastSeenImportId: importId,
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
            planId,
            planAssignment:
              shouldAssignPlan && assignment.planAssignment === 'auto_month'
                ? ('auto_month' as const)
                : ('none' as const),
            importSeenCount: existing.importSeenCount + 1,
            createdAt: now,
            updatedAt: now,
          }
        } else {
          insertedCount += 1
          if (assignment.planId) assigned += 1
          else unassigned += 1

          return {
            sourceId: preparedData.source.id,
            firstSeenImportId: importId,
            lastSeenImportId: importId,
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
            planId: assignment.planId,
            planAssignment: assignment.planAssignment,
            importSeenCount: 1,
            createdAt: now,
            updatedAt: now,
          }
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)

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
        importedCount: insertedCount,
        updatedCount,
        skippedCount: preparedData.duplicateInFile,
        errorMessage: null,
        triggeredByUserId: input.triggeredByUserId ?? null,
        createdAt: now,
      })

      // Upgrade pending → booked for cross-import matches
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

      if (allRows.length > 0) {
        await tx
          .insert(bankTransaction)
          .values(allRows)
          .onConflictDoUpdate({
            target: [bankTransaction.sourceId, bankTransaction.dedupeKey],
            set: {
              externalTransactionId: sql.raw(
                `excluded.${bankTransaction.externalTransactionId.name}`,
              ),
              bookingDate: sql.raw(
                `excluded.${bankTransaction.bookingDate.name}`,
              ),
              valueDate: sql.raw(`excluded.${bankTransaction.valueDate.name}`),
              amountCents: sql.raw(
                `excluded.${bankTransaction.amountCents.name}`,
              ),
              currency: sql.raw(`excluded.${bankTransaction.currency.name}`),
              originalAmountCents: sql.raw(
                `excluded.${bankTransaction.originalAmountCents.name}`,
              ),
              originalCurrency: sql.raw(
                `excluded.${bankTransaction.originalCurrency.name}`,
              ),
              counterparty: sql.raw(
                `excluded.${bankTransaction.counterparty.name}`,
              ),
              bookingText: sql.raw(
                `excluded.${bankTransaction.bookingText.name}`,
              ),
              description: sql.raw(
                `excluded.${bankTransaction.description.name}`,
              ),
              purpose: sql.raw(`excluded.${bankTransaction.purpose.name}`),
              status: sql.raw(`excluded.${bankTransaction.status.name}`),
              balanceAfterCents: sql.raw(
                `excluded.${bankTransaction.balanceAfterCents.name}`,
              ),
              balanceCurrency: sql.raw(
                `excluded.${bankTransaction.balanceCurrency.name}`,
              ),
              country: sql.raw(`excluded.${bankTransaction.country.name}`),
              cardLast4: sql.raw(`excluded.${bankTransaction.cardLast4.name}`),
              cardholder: sql.raw(
                `excluded.${bankTransaction.cardholder.name}`,
              ),
              rawDataJson: sql.raw(
                `excluded.${bankTransaction.rawDataJson.name}`,
              ),
              lastSeenImportId: sql.raw(
                `excluded.${bankTransaction.lastSeenImportId.name}`,
              ),
              importSeenCount: sql.raw(
                `"bank_transaction"."${bankTransaction.importSeenCount.name}" + 1`,
              ),
              planAssignment: sql.raw(
                `CASE WHEN "bank_transaction"."${bankTransaction.planAssignment.name}" = 'manual' OR "bank_transaction"."${bankTransaction.planId.name}" IS NOT NULL THEN "bank_transaction"."${bankTransaction.planAssignment.name}" ELSE excluded."${bankTransaction.planAssignment.name}" END`,
              ),
              planId: sql.raw(
                `CASE WHEN "bank_transaction"."${bankTransaction.planAssignment.name}" = 'manual' OR "bank_transaction"."${bankTransaction.planId.name}" IS NOT NULL THEN "bank_transaction"."${bankTransaction.planId.name}" ELSE excluded."${bankTransaction.planId.name}" END`,
              ),
              updatedAt: sql.raw(`excluded.${bankTransaction.updatedAt.name}`),
            },
          })
      }
    })

    return {
      importId,
      inserted: insertedCount,
      updated: updatedCount,
      skipped: preparedData.duplicateInFile,
      assigned,
      unassigned,
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
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Unbekannter Fehler beim Import',
        triggeredByUserId: input.triggeredByUserId ?? null,
      })
    }
    throw error
  }
}
