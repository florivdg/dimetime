import { beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { eq, sql } from 'drizzle-orm'
import {
  bankTransaction,
  bankTransactionSplit,
  plannedTransaction,
  statementImport,
} from '@/db/schema/plans'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import { makeCsvFile } from '@/lib/__fixtures__/sample-csv'
import {
  seedBankTransaction,
  seedBankTransactionSplit,
  seedImportSource,
  seedPlan,
  seedPlannedTransaction,
} from '@/lib/__fixtures__/seeds'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'

const testDb = setupTestDb()
const { splitBankTransaction, unsplitBankTransaction } =
  await import('./bank-transaction-splits')
const { updateTransaction } = await import('./transactions')
const { commitBankImport } = await import('./bank-import/service')
const assignPlanRoute =
  await import('@/pages/api/bank-transactions/bulk-assign-plan')
const assignBudgetRoute =
  await import('@/pages/api/bank-transactions/bulk-assign-budget')

const planId = '11111111-1111-4111-8111-111111111111'
const parentId = '22222222-2222-4222-8222-222222222222'
const budgetId = '33333333-3333-4333-8333-333333333333'
const splitId = '44444444-4444-4444-8444-444444444444'

beforeEach(async () => {
  await seedPlan(testDb, { id: planId })
  await seedPlannedTransaction(testDb, { id: budgetId, planId, isBudget: true })
  await seedImportSource(testDb)
  await seedBankTransaction(testDb, { id: parentId, planId, budgetId })
})

async function state() {
  return {
    transactions: await testDb.select().from(bankTransaction),
    splits: await testDb.select().from(bankTransactionSplit),
    budgets: await testDb.select().from(plannedTransaction),
  }
}

async function expectWriteFailure(operation: Promise<unknown>) {
  const error = await operation.catch((reason: unknown) => reason)
  expect(error).toBeInstanceOf(Error)
  expect((error as Error).message).toContain('forced atomicity failure')
}

/** A real SQLite failure after earlier writes, with cleanup even if an assertion fails. */
async function withWriteFailure(
  event: 'INSERT' | 'UPDATE',
  table: 'bank_transaction' | 'bank_transaction_split' | 'planned_transaction',
  check: () => Promise<void>,
) {
  testDb.run(
    sql.raw(
      `CREATE TEMP TRIGGER fail_atomic_write BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT, 'forced atomicity failure'); END`,
    ),
  )
  try {
    await check()
  } finally {
    testDb.run(sql`DROP TRIGGER fail_atomic_write`)
  }
}

describe('SQLite write atomicity', () => {
  it('restores the parent and budget when inserting split rows fails', async () => {
    const before = await state()
    await withWriteFailure('INSERT', 'bank_transaction_split', async () => {
      await expectWriteFailure(
        splitBankTransaction(parentId, [
          { amountCents: -400 },
          { amountCents: -600 },
        ]),
      )
      expect(await state()).toEqual(before)
    })
  })

  it('restores deleted splits when restoring the parent fails', async () => {
    await splitBankTransaction(parentId, [
      { amountCents: -400 },
      { amountCents: -600 },
    ])
    const before = await state()
    await withWriteFailure('UPDATE', 'bank_transaction', async () => {
      await expectWriteFailure(unsplitBankTransaction(parentId))
      expect(await state()).toEqual(before)
    })
  })

  it('restores all budget references when the final budget update fails', async () => {
    await testDb
      .update(bankTransaction)
      .set({ preSplitBudgetId: budgetId })
      .where(eq(bankTransaction.id, parentId))
    await seedBankTransactionSplit(testDb, {
      id: splitId,
      bankTransactionId: parentId,
      planId,
      budgetId,
    })
    const before = await state()
    await withWriteFailure('UPDATE', 'planned_transaction', async () => {
      await expectWriteFailure(
        updateTransaction(budgetId, {
          isBudget: false,
          confirmClearBudgetLinks: true,
        }),
      )
      expect(await state()).toEqual(before)
    })
  })

  it('rolls back the success import log and rows, retaining only a failure log', async () => {
    const before = await state()
    await withWriteFailure('INSERT', 'bank_transaction', async () => {
      await expectWriteFailure(
        commitBankImport({ sourceId: 's1', file: makeCsvFile() }),
      )
      expect(await state()).toEqual(before)
      expect(
        await testDb
          .select({
            status: statementImport.status,
            phase: statementImport.phase,
            importedCount: statementImport.importedCount,
          })
          .from(statementImport),
      ).toEqual([{ status: 'failed', phase: 'commit', importedCount: 0 }])
    })
  })

  it.each([
    [
      'plan',
      assignPlanRoute.POST,
      { planId: null },
      'Fehler beim Zuweisen des Plans',
    ],
    [
      'budget',
      assignBudgetRoute.POST,
      { budgetId: null },
      'Fehler beim Zuweisen des Budgets',
    ],
  ] as const)(
    'rolls back bulk %s assignments when updating a split fails',
    async (_name, route, assignment, expectedError) => {
      await seedBankTransactionSplit(testDb, {
        id: splitId,
        bankTransactionId: parentId,
        planId,
        budgetId,
      })
      const before = await state()
      const log = spyOn(console, 'error').mockImplementation(() => {})
      try {
        await withWriteFailure('UPDATE', 'bank_transaction_split', async () => {
          const response = (await route(
            buildApiContext({
              method: 'POST',
              body: { ids: [parentId], splitIds: [splitId], ...assignment },
            }) as never,
          )) as Response
          expect(response.status).toBe(500)
          expect(await response.json()).toEqual({ error: expectedError })
          expect(log).toHaveBeenCalledTimes(1)
          expect(await state()).toEqual(before)
        })
      } finally {
        log.mockRestore()
      }
    },
  )
})
