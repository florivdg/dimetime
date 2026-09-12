import { beforeEach, describe, expect, it } from 'bun:test'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import {
  buildImportFormData,
  seedImportSource,
  seedUser,
} from '@/lib/__fixtures__/seeds'
import { makeCsvFile } from '@/lib/__fixtures__/sample-csv'
import { bankTransaction, statementImport } from '@/db/schema/plans'

const testDb = setupTestDb()

const { POST } = await import('./commit')

const sourceId = 'src-1'

beforeEach(async () => {
  await seedImportSource(testDb, { id: sourceId, name: 'ING' })
  await seedUser(testDb, { id: 'user-1' })
})

describe('POST /api/bank-imports/commit', () => {
  it('persists rows on success', async () => {
    const res = (await POST({
      request: buildImportFormData('/api/bank-imports/commit', {
        sourceId,
        file: makeCsvFile(),
      }),
      locals: { user: { id: 'user-1' } },
    } as never)) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      importId: expect.any(String),
      inserted: 1,
      updated: 0,
      skipped: 0,
      assigned: 0,
      unassigned: 1,
      warnings: [
        '1 Transaktionen konnten keinem eindeutigen Monatsplan zugeordnet werden.',
      ],
    })
    expect(
      await testDb
        .select({
          amount: bankTransaction.amountCents,
          bookingDate: bankTransaction.bookingDate,
          firstSeenImportId: bankTransaction.firstSeenImportId,
        })
        .from(bankTransaction),
    ).toEqual([
      {
        amount: -4500,
        bookingDate: '2026-03-01',
        firstSeenImportId: body.importId,
      },
    ])
    expect(
      await testDb
        .select({
          id: statementImport.id,
          status: statementImport.status,
          importedCount: statementImport.importedCount,
          userId: statementImport.triggeredByUserId,
        })
        .from(statementImport),
    ).toEqual([
      {
        id: body.importId,
        status: 'success',
        importedCount: 1,
        userId: 'user-1',
      },
    ])
  })

  it('returns error response when parsing fails', async () => {
    const file = new File(['garbage'], 'statement.csv', { type: 'text/csv' })
    const res = (await POST({
      request: buildImportFormData('/api/bank-imports/commit', {
        sourceId,
        file,
      }),
      locals: {},
    } as never)) as Response
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error:
        'ING-CSV konnte nicht gelesen werden: Kopfzeile mit Pflichtspalten nicht gefunden.',
    })
    expect(await testDb.select().from(bankTransaction)).toEqual([])
    expect(await testDb.select().from(statementImport)).toEqual([])
  })
})
