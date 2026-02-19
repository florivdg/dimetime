import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const dbPath = join(
  tmpdir(),
  `dimetime-reconcile-safe-${crypto.randomUUID()}.sqlite`,
)

process.env.DB_FILE_NAME = dbPath

const setupDb = new Database(dbPath)
setupDb.run(`
CREATE TABLE transaction_reconciliation (
  id TEXT PRIMARY KEY,
  bank_transaction_id TEXT NOT NULL,
  planned_transaction_id TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'manual',
  confidence INTEGER,
  matched_at INTEGER NOT NULL,
  matched_by_user_id TEXT
)
`)
setupDb.run(`
CREATE UNIQUE INDEX transactionReconciliation_bankTransactionId_idx
ON transaction_reconciliation (bank_transaction_id)
`)
setupDb.run(`
CREATE UNIQUE INDEX transactionReconciliation_plannedTransactionId_idx
ON transaction_reconciliation (planned_transaction_id)
`)
setupDb.close()

const { createManualReconciliationSafely } =
  await import('@/lib/bank-transactions')

function insertReconciliation(values: {
  id: string
  bankTransactionId: string
  plannedTransactionId: string
}) {
  const db = new Database(dbPath)
  db.query(
    `INSERT INTO transaction_reconciliation
      (id, bank_transaction_id, planned_transaction_id, match_type, confidence, matched_at, matched_by_user_id)
      VALUES (?, ?, ?, 'manual', NULL, ?, NULL)`,
  ).run(
    values.id,
    values.bankTransactionId,
    values.plannedTransactionId,
    Date.now(),
  )
  db.close()
}

beforeEach(() => {
  const db = new Database(dbPath)
  db.run('DELETE FROM transaction_reconciliation')
  db.close()
})

afterAll(() => {
  rmSync(dbPath, { force: true })
  rmSync(`${dbPath}-shm`, { force: true })
  rmSync(`${dbPath}-wal`, { force: true })
})

describe('createManualReconciliationSafely', () => {
  it('creates a new reconciliation', async () => {
    const result = await createManualReconciliationSafely({
      bankTransactionId: 'bank-1',
      plannedTransactionId: 'planned-1',
      matchedByUserId: 'user-1',
    })

    expect(result.status).toBe('created')
    expect(result.reconciliation.bankTransactionId).toBe('bank-1')
    expect(result.reconciliation.plannedTransactionId).toBe('planned-1')
  })

  it('returns bank_conflict on unique constraint violation for bank_transaction_id', async () => {
    insertReconciliation({
      id: 'existing-1',
      bankTransactionId: 'bank-1',
      plannedTransactionId: 'planned-x',
    })

    const result = await createManualReconciliationSafely({
      bankTransactionId: 'bank-1',
      plannedTransactionId: 'planned-1',
      matchedByUserId: null,
    })

    expect(result.status).toBe('bank_conflict')
    expect(result.reconciliation.id).toBe('existing-1')
  })

  it('returns planned_conflict on unique constraint violation for planned_transaction_id', async () => {
    insertReconciliation({
      id: 'existing-2',
      bankTransactionId: 'bank-x',
      plannedTransactionId: 'planned-1',
    })

    const result = await createManualReconciliationSafely({
      bankTransactionId: 'bank-1',
      plannedTransactionId: 'planned-1',
      matchedByUserId: null,
    })

    expect(result.status).toBe('planned_conflict')
    expect(result.reconciliation.id).toBe('existing-2')
  })
})
