import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from 'bun:test'
import { Database } from 'bun:sqlite'
import { count, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as plansSchema from '@/db/schema/plans'
import type { NormalizedBankTransactionInput } from './types'

const sqlite = new Database(':memory:')
sqlite.run('PRAGMA foreign_keys = ON;')

const testDb = drizzle({
  client: sqlite,
  schema: plansSchema,
})

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const { upsertNormalizedBankTransactions } = await import('./service')
const ingestRoute = await import('@/pages/api/ingest/bank-transactions.ts')

const now = new Date('2026-04-24T00:00:00.000Z')
const sourceId = '94673667-8498-4eaf-8c38-4fb8e0bef704'
const planId = '11111111-1111-4111-8111-111111111111'

function runStatements(sql: string) {
  for (const statement of sql.split(';')) {
    const trimmed = statement.trim()
    if (trimmed) sqlite.run(trimmed)
  }
}

beforeAll(() => {
  runStatements(`
    CREATE TABLE "user" (
      "id" text PRIMARY KEY NOT NULL
    );

    CREATE TABLE "plan" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text,
      "date" text NOT NULL,
      "notes" text,
      "is_archived" integer DEFAULT false NOT NULL,
      "created_at" integer NOT NULL,
      "updated_at" integer NOT NULL
    );

    CREATE TABLE "planned_transaction" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "note" text,
      "type" text DEFAULT 'expense' NOT NULL,
      "due_date" text NOT NULL,
      "amount" integer DEFAULT 0 NOT NULL,
      "is_done" integer DEFAULT false NOT NULL,
      "completed_at" integer,
      "is_budget" integer DEFAULT false NOT NULL,
      "created_at" integer NOT NULL,
      "updated_at" integer NOT NULL,
      "plan_id" text REFERENCES "plan"("id") ON DELETE cascade,
      "user_id" text REFERENCES "user"("id") ON DELETE set null,
      "category_id" text
    );

    CREATE TABLE "import_source" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "preset" text NOT NULL,
      "source_kind" text NOT NULL,
      "bank_name" text,
      "account_label" text,
      "account_identifier" text,
      "default_plan_assignment" text DEFAULT 'auto_month' NOT NULL,
      "is_active" integer DEFAULT true NOT NULL,
      "created_at" integer NOT NULL,
      "updated_at" integer NOT NULL
    );

    CREATE TABLE "statement_import" (
      "id" text PRIMARY KEY NOT NULL,
      "source_id" text NOT NULL REFERENCES "import_source"("id") ON DELETE cascade,
      "file_name" text,
      "file_sha256" text,
      "file_type" text NOT NULL,
      "phase" text NOT NULL,
      "status" text NOT NULL,
      "preview_count" integer DEFAULT 0 NOT NULL,
      "imported_count" integer DEFAULT 0 NOT NULL,
      "updated_count" integer DEFAULT 0 NOT NULL,
      "skipped_count" integer DEFAULT 0 NOT NULL,
      "error_message" text,
      "triggered_by_user_id" text REFERENCES "user"("id") ON DELETE set null,
      "created_at" integer NOT NULL
    );

    CREATE TABLE "bank_transaction" (
      "id" text PRIMARY KEY NOT NULL,
      "source_id" text NOT NULL REFERENCES "import_source"("id") ON DELETE cascade,
      "first_seen_import_id" text REFERENCES "statement_import"("id") ON DELETE set null,
      "last_seen_import_id" text REFERENCES "statement_import"("id") ON DELETE set null,
      "external_transaction_id" text,
      "dedupe_key" text NOT NULL,
      "booking_date" text NOT NULL,
      "value_date" text,
      "amount_cents" integer NOT NULL,
      "currency" text DEFAULT 'EUR' NOT NULL,
      "original_amount_cents" integer,
      "original_currency" text,
      "counterparty" text,
      "booking_text" text,
      "description" text,
      "purpose" text,
      "status" text DEFAULT 'unknown' NOT NULL,
      "balance_after_cents" integer,
      "balance_currency" text,
      "country" text,
      "card_last4" text,
      "cardholder" text,
      "note" text,
      "raw_data_json" text NOT NULL,
      "plan_id" text REFERENCES "plan"("id") ON DELETE set null,
      "plan_assignment" text DEFAULT 'none' NOT NULL,
      "budget_id" text REFERENCES "planned_transaction"("id") ON DELETE set null,
      "pre_split_budget_id" text REFERENCES "planned_transaction"("id") ON DELETE set null,
      "is_archived" integer DEFAULT false NOT NULL,
      "is_split" integer DEFAULT false NOT NULL,
      "import_seen_count" integer DEFAULT 1 NOT NULL,
      "created_at" integer NOT NULL,
      "updated_at" integer NOT NULL
    );

    CREATE UNIQUE INDEX "bankTransaction_sourceId_dedupeKey_idx"
      ON "bank_transaction" ("source_id", "dedupe_key");
  `)
})

beforeEach(async () => {
  runStatements(`
    DELETE FROM "bank_transaction";
    DELETE FROM "statement_import";
    DELETE FROM "planned_transaction";
    DELETE FROM "plan";
    DELETE FROM "import_source";
  `)

  await testDb.insert(plansSchema.importSource).values({
    id: sourceId,
    name: 'Testkonto',
    preset: 'ing_csv_v1',
    sourceKind: 'bank_account',
    defaultPlanAssignment: 'auto_month',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })
})

afterAll(() => {
  sqlite.close()
})

function makeInputRow(
  overrides: Partial<NormalizedBankTransactionInput> = {},
): NormalizedBankTransactionInput {
  return {
    externalTransactionId: null,
    bookingDate: '2026-04-20',
    valueDate: null,
    amountCents: -1000,
    currency: 'EUR',
    originalAmountCents: null,
    originalCurrency: null,
    counterparty: 'Cafe',
    bookingText: null,
    description: 'Kaffee',
    purpose: null,
    status: 'booked',
    balanceAfterCents: null,
    balanceCurrency: null,
    country: null,
    cardLast4: null,
    cardholder: null,
    rawData: {},
    ...overrides,
  }
}

async function createPlan() {
  await testDb.insert(plansSchema.plan).values({
    id: planId,
    name: 'April',
    date: '2026-04-01',
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  })
}

async function createPendingTransaction() {
  await testDb.insert(plansSchema.bankTransaction).values({
    id: 'pending-1',
    sourceId,
    dedupeKey: 'pending-key',
    bookingDate: '2026-04-20',
    amountCents: -1000,
    currency: 'EUR',
    description: 'Kaffee',
    status: 'pending',
    rawDataJson: '{}',
    planId: null,
    planAssignment: 'none',
    isArchived: false,
    isSplit: false,
    importSeenCount: 1,
    createdAt: now,
    updatedAt: now,
  })
}

function ingestRequest(body: unknown): Parameters<typeof ingestRoute.POST>[0] {
  return {
    request: new Request('http://localhost/api/ingest/bank-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    locals: {
      apiKey: {
        id: 'key-1',
        referenceId: null,
        name: 'Test-Key',
        permissions: { bank_transactions: ['write'] },
      },
    },
  } as never
}

describe('upsertNormalizedBankTransactions', () => {
  it('persists auto assignment when upgrading a pending transaction to booked', async () => {
    await createPlan()
    await createPendingTransaction()

    const result = await upsertNormalizedBankTransactions({
      sourceId,
      rows: [makeInputRow()],
    })

    expect(result.inserted).toBe(0)
    expect(result.updated).toBe(1)
    expect(result.assigned).toBe(1)
    expect(result.unassigned).toBe(0)

    const transaction = await testDb.query.bankTransaction.findFirst({
      where: eq(plansSchema.bankTransaction.id, 'pending-1'),
    })
    expect(transaction?.status).toBe('booked')
    expect(transaction?.planId).toBe(planId)
    expect(transaction?.planAssignment).toBe('auto_month')
  })
})

describe('companion ingest endpoint', () => {
  it('normalizes API currencies before dedupe and persistence', async () => {
    await createPlan()

    const firstResponse = await ingestRoute.POST(
      ingestRequest({
        sourceId,
        rows: [makeInputRow({ currency: 'eur' })],
      }),
    )
    expect(firstResponse.status).toBe(200)
    expect((await firstResponse.json()).inserted).toBe(1)

    const secondResponse = await ingestRoute.POST(
      ingestRequest({
        sourceId,
        rows: [makeInputRow({ currency: 'EUR' })],
      }),
    )
    expect(secondResponse.status).toBe(200)
    expect((await secondResponse.json()).updated).toBe(1)

    const [{ total }] = await testDb
      .select({ total: count() })
      .from(plansSchema.bankTransaction)
    expect(total).toBe(1)

    const transaction = await testDb.query.bankTransaction.findFirst()
    expect(transaction?.currency).toBe('EUR')
  })

  it('rejects oversized JSON bodies', async () => {
    const response = await ingestRoute.POST(
      ingestRequest(`{"payload":"${'x'.repeat(1024 * 1024)}"}`),
    )

    expect(response.status).toBe(413)
  })

  it('rejects oversized rawData objects', async () => {
    const rawData = Object.fromEntries(
      Array.from({ length: 51 }, (_, index) => [`field${index}`, 'value']),
    )

    const response = await ingestRoute.POST(
      ingestRequest({
        sourceId,
        rows: [makeInputRow({ rawData })],
      }),
    )

    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain('rawData')
  })
})
