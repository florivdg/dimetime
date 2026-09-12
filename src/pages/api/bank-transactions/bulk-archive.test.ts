import { beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { eq, sql } from 'drizzle-orm'
import { bankTransaction, bankTransactionSplit } from '@/db/schema/plans'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import { itRejectsInvalidJson } from '@/lib/__fixtures__/route-guards'
import {
  seedBankTransaction,
  seedBankTransactionSplit,
  seedImportSource,
} from '@/lib/__fixtures__/seeds'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'

const testDb = setupTestDb()
const { POST } = await import('./bulk-archive')
const transactionId = '11111111-1111-4111-8111-111111111111'
const otherTransactionId = '22222222-2222-4222-8222-222222222222'
const splitId = '33333333-3333-4333-8333-333333333333'
const missingId = '99999999-9999-4999-8999-999999999999'

async function post(body: unknown) {
  return (await POST(
    buildApiContext({ method: 'POST', body }) as never,
  )) as Response
}

async function archiveState() {
  const transactions = await testDb
    .select({ id: bankTransaction.id, archived: bankTransaction.isArchived })
    .from(bankTransaction)
    .orderBy(bankTransaction.id)
  const splits = await testDb
    .select({
      id: bankTransactionSplit.id,
      archived: bankTransactionSplit.isArchived,
    })
    .from(bankTransactionSplit)
  return { transactions, splits }
}

beforeEach(async () => {
  await seedImportSource(testDb)
  await seedBankTransaction(testDb, { id: transactionId })
  await seedBankTransaction(testDb, {
    id: otherTransactionId,
    dedupeKey: 'other',
    isSplit: true,
  })
  await seedBankTransactionSplit(testDb, {
    id: splitId,
    bankTransactionId: otherTransactionId,
  })
})

describe('POST /api/bank-transactions/bulk-archive', () => {
  itRejectsInvalidJson(POST)

  it.each([
    ['an empty selection', { ids: [], splitIds: [], isArchived: true }],
    ['invalid IDs', { ids: ['invalid'], isArchived: true }],
    ['a non-boolean archive flag', { splitIds: [splitId], isArchived: 'true' }],
    [
      'more than 100 IDs',
      {
        ids: Array.from({ length: 101 }, () => transactionId),
        isArchived: true,
      },
    ],
  ])('rejects %s without changing any rows', async (_label, body) => {
    const before = await archiveState()
    const response = await post(body)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: expect.any(String) })
    expect(await archiveState()).toEqual(before)
  })

  it('archives only requested transactions and splits, counting existing rows once', async () => {
    const response = await post({
      ids: [transactionId, transactionId, missingId],
      splitIds: [splitId],
      isArchived: true,
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, count: 2 })
    expect(await archiveState()).toEqual({
      transactions: [
        { id: transactionId, archived: true },
        { id: otherTransactionId, archived: false },
      ],
      splits: [{ id: splitId, archived: true }],
    })
  })

  it('unarchives split-only selections without changing their parent', async () => {
    await testDb
      .update(bankTransactionSplit)
      .set({ isArchived: true })
      .where(eq(bankTransactionSplit.id, splitId))
    await testDb
      .update(bankTransaction)
      .set({ isArchived: true })
      .where(eq(bankTransaction.id, otherTransactionId))
    const response = await post({ splitIds: [splitId], isArchived: false })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, count: 1 })
    expect(await archiveState()).toEqual({
      transactions: [
        { id: transactionId, archived: false },
        { id: otherTransactionId, archived: true },
      ],
      splits: [{ id: splitId, archived: false }],
    })
  })

  it('rolls back transaction updates when updating a split fails', async () => {
    const before = await archiveState()
    const log = spyOn(console, 'error').mockImplementation(() => {})
    testDb.run(
      sql`CREATE TEMP TRIGGER fail_split_archive BEFORE UPDATE ON bank_transaction_split BEGIN SELECT RAISE(ABORT, 'test split failure'); END`,
    )
    try {
      const response = await post({
        ids: [transactionId],
        splitIds: [splitId],
        isArchived: true,
      })
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Fehler beim Archivieren der Transaktionen',
      })
      expect(log).toHaveBeenCalledTimes(1)
      expect(await archiveState()).toEqual(before)
    } finally {
      testDb.run(sql`DROP TRIGGER fail_split_archive`)
      log.mockRestore()
    }
  })
})
