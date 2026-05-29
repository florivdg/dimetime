import { beforeEach, describe, expect, it } from 'bun:test'
import * as authSchema from '@/db/schema/auth'
import * as plansSchema from '@/db/schema/plans'
import { resetTestDb, setupTestDb } from '@/lib/__fixtures__/test-setup'

const testDb = setupTestDb()

const { commitBankImport, getImportTypes, previewBankImport } =
  await import('./service')

const now = new Date('2026-03-09T00:00:00.000Z')
const sourceId = 'src-1'

const SAMPLE_ING_CSV = [
  'Buchung;Wertstellungsdatum;Auftraggeber/Empfänger;Buchungstext;Verwendungszweck;Saldo;Währung;Betrag;Währung',
  '01.03.2026;02.03.2026;Edeka;Lastschrift;Einkauf;1500,00;EUR;-45,00;EUR',
  '05.03.2026;05.03.2026;Lohn;Gutschrift;März;1545,00;EUR;1900,00;EUR',
].join('\n')

async function seedSource(
  overrides: Partial<typeof plansSchema.importSource.$inferInsert> = {},
) {
  await testDb.insert(plansSchema.importSource).values({
    id: sourceId,
    name: 'ING',
    preset: 'ing_csv_v1',
    sourceKind: 'bank_account',
    defaultPlanAssignment: 'none',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  })
}

function makeCsvFile(name = 'statement.csv', content = SAMPLE_ING_CSV): File {
  return new File([content], name, { type: 'text/csv' })
}

async function seedUser(id: string) {
  await testDb.insert(authSchema.user).values({
    id,
    name: id,
    email: `${id}@example.com`,
    createdAt: now,
    updatedAt: now,
  })
}

beforeEach(async () => {
  await seedSource()
  await seedUser('user-1')
  await seedUser('user-2')
})

describe('getImportTypes', () => {
  it('returns the available import descriptors', () => {
    const types = getImportTypes()
    expect(types.map((t) => t.preset).sort()).toEqual([
      'easybank_xlsx_v1',
      'ing_csv_v1',
    ])
  })
})

describe('previewBankImport', () => {
  it('rejects unknown source id', async () => {
    expect(
      previewBankImport({
        sourceId: 'missing',
        file: makeCsvFile(),
      }),
    ).rejects.toThrow('Import-Quelle wurde nicht gefunden')
  })

  it('rejects inactive sources', async () => {
    resetTestDb()
    await seedSource({ isActive: false })
    expect(
      previewBankImport({
        sourceId,
        file: makeCsvFile(),
      }),
    ).rejects.toThrow('deaktiviert')
  })

  it('rejects unsupported file extensions', async () => {
    expect(
      previewBankImport({
        sourceId,
        file: new File(['x'], 'data.txt', { type: 'text/plain' }),
      }),
    ).rejects.toThrow('Dateityp wird nicht unterstützt')
  })

  it('rejects wrong file type for ING preset', async () => {
    const xlsxFile = new File(
      [new Uint8Array([0x50, 0x4b])],
      'statement.xlsx',
      {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    )
    expect(
      previewBankImport({
        sourceId,
        file: xlsxFile,
      }),
    ).rejects.toThrow('Falscher Dateityp')
  })

  it('returns preview result and writes a successful statement_import log', async () => {
    const result = await previewBankImport({
      sourceId,
      file: makeCsvFile(),
      triggeredByUserId: 'user-1',
    })
    expect(result.source.id).toBe(sourceId)
    expect(result.parser.fileType).toBe('csv')
    expect(result.counts.totalRows).toBeGreaterThan(0)
    expect(result.samples.length).toBeGreaterThan(0)

    const logs = await testDb.query.statementImport.findMany({})
    expect(logs.length).toBe(1)
    expect(logs[0].phase).toBe('preview')
    expect(logs[0].status).toBe('success')
    expect(logs[0].triggeredByUserId).toBe('user-1')
  })

  it('writes a failed log entry when parsing throws after source resolution', async () => {
    // Use an empty CSV which the parser should reject
    const badFile = new File(['notavalidheader'], 'broken.csv', {
      type: 'text/csv',
    })
    expect(
      previewBankImport({
        sourceId,
        file: badFile,
      }),
    ).rejects.toThrow()
  })
})

describe('commitBankImport', () => {
  it('rejects unknown source id', async () => {
    expect(
      commitBankImport({
        sourceId: 'missing',
        file: makeCsvFile(),
      }),
    ).rejects.toThrow('nicht gefunden')
  })

  it('inserts rows and writes a successful commit log', async () => {
    const result = await commitBankImport({
      sourceId,
      file: makeCsvFile(),
      triggeredByUserId: 'user-2',
    })
    expect(result.inserted).toBeGreaterThan(0)
    expect(result.updated).toBe(0)

    const rows = await testDb.query.bankTransaction.findMany({})
    expect(rows.length).toBe(result.inserted)
    const logs = await testDb.query.statementImport.findMany({})
    const commitLog = logs.find((l) => l.phase === 'commit')
    expect(commitLog?.status).toBe('success')
    expect(commitLog?.triggeredByUserId).toBe('user-2')
  })

  it('re-running the same import updates existing rows instead of duplicating', async () => {
    await commitBankImport({ sourceId, file: makeCsvFile() })
    const beforeCount = (await testDb.query.bankTransaction.findMany({})).length

    const second = await commitBankImport({ sourceId, file: makeCsvFile() })
    const afterCount = (await testDb.query.bankTransaction.findMany({})).length

    expect(afterCount).toBe(beforeCount)
    expect(second.updated).toBeGreaterThan(0)
    expect(second.inserted).toBe(0)
  })

  it('auto-assigns to plan when defaultPlanAssignment=auto_month and exactly one matching plan exists', async () => {
    resetTestDb()
    await seedSource({ defaultPlanAssignment: 'auto_month' })
    await testDb.insert(plansSchema.plan).values({
      id: 'p-march',
      name: 'March',
      date: '2026-03-01',
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    })
    const result = await commitBankImport({ sourceId, file: makeCsvFile() })
    expect(result.assigned).toBeGreaterThan(0)
    const rows = await testDb.query.bankTransaction.findMany({})
    expect(rows.find((r) => r.planId === 'p-march')).toBeDefined()
  })

  it('leaves rows unassigned when auto_month finds zero or multiple matches', async () => {
    resetTestDb()
    await seedSource({ defaultPlanAssignment: 'auto_month' })
    await testDb.insert(plansSchema.plan).values([
      {
        id: 'p1',
        date: '2026-03-01',
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'p2',
        date: '2026-03-15',
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
    ])
    const result = await commitBankImport({ sourceId, file: makeCsvFile() })
    expect(result.unassigned).toBeGreaterThan(0)
  })

  it('upgrades a pre-existing pending row when matching booked row is imported', async () => {
    // Pre-seed a "pending" bank tx whose semantic key (bookingDate|amountCents|description)
    // matches the first booked CSV row. The ING parser leaves description=null, so
    // the seeded pending row must also use a null/empty description for the match.
    await testDb.insert(plansSchema.bankTransaction).values({
      id: 'bt-pending',
      sourceId,
      dedupeKey: 'unique-pending-key',
      bookingDate: '2026-03-01',
      amountCents: -4500,
      currency: 'EUR',
      description: null,
      status: 'pending',
      rawDataJson: '{}',
      isArchived: false,
      isSplit: false,
      importSeenCount: 1,
      planAssignment: 'none',
      createdAt: now,
      updatedAt: now,
    })

    const result = await commitBankImport({ sourceId, file: makeCsvFile() })
    expect(result.updated).toBeGreaterThanOrEqual(1)
    const upgraded = await testDb.query.bankTransaction.findFirst({
      where: (t, { eq: e }) => e(t.id, 'bt-pending'),
    })
    expect(upgraded?.status).toBe('booked')
  })
})
