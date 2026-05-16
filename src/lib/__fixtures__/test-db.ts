import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as authSchema from '@/db/schema/auth'
import * as plansSchema from '@/db/schema/plans'
import * as settingsSchema from '@/db/schema/settings'
import * as userRelationsSchema from '@/db/schema/user-relations'

const DDL = `
  CREATE TABLE "user" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL DEFAULT '',
    "email" text NOT NULL DEFAULT '',
    "email_verified" integer DEFAULT false NOT NULL,
    "image" text,
    "created_at" integer NOT NULL DEFAULT 0,
    "updated_at" integer NOT NULL DEFAULT 0,
    "role" text,
    "banned" integer DEFAULT false,
    "ban_reason" text,
    "ban_expires" integer,
    "two_factor_enabled" integer DEFAULT false
  );

  CREATE TABLE "two_factor" (
    "id" text PRIMARY KEY NOT NULL,
    "secret" text NOT NULL,
    "backup_codes" text NOT NULL,
    "verified" integer DEFAULT true NOT NULL,
    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade
  );

  CREATE TABLE "user_setting" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
    "key" text NOT NULL,
    "value" text NOT NULL,
    "created_at" integer NOT NULL,
    "updated_at" integer NOT NULL
  );

  CREATE UNIQUE INDEX "userSetting_userId_key_idx" ON "user_setting"("user_id","key");

  CREATE TABLE "category" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "slug" text NOT NULL,
    "color" text,
    "created_at" integer NOT NULL,
    "updated_at" integer NOT NULL
  );

  CREATE UNIQUE INDEX "category_slug_idx" ON "category"("slug");

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
    "category_id" text REFERENCES "category"("id") ON DELETE set null
  );

  CREATE TABLE "transaction_preset" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "note" text,
    "type" text DEFAULT 'expense' NOT NULL,
    "amount" integer DEFAULT 0 NOT NULL,
    "recurrence" text DEFAULT 'einmalig' NOT NULL,
    "start_month" text,
    "end_date" text,
    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
    "category_id" text REFERENCES "category"("id") ON DELETE set null,
    "day_of_month" integer,
    "is_budget" integer DEFAULT false NOT NULL,
    "last_used_at" integer,
    "created_at" integer NOT NULL,
    "updated_at" integer NOT NULL
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
    "file_name" text NOT NULL,
    "file_sha256" text NOT NULL,
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

  CREATE UNIQUE INDEX "bankTransaction_sourceId_dedupeKey_idx" ON "bank_transaction"("source_id","dedupe_key");

  CREATE TABLE "bank_transaction_split" (
    "id" text PRIMARY KEY NOT NULL,
    "bank_transaction_id" text NOT NULL REFERENCES "bank_transaction"("id") ON DELETE cascade,
    "amount_cents" integer NOT NULL,
    "label" text,
    "note" text,
    "budget_id" text REFERENCES "planned_transaction"("id") ON DELETE set null,
    "plan_id" text REFERENCES "plan"("id") ON DELETE set null,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_archived" integer DEFAULT false NOT NULL,
    "created_at" integer NOT NULL,
    "updated_at" integer NOT NULL
  );
`

const TRUNCATE_ORDER = [
  'bank_transaction_split',
  'bank_transaction',
  'statement_import',
  'import_source',
  'transaction_preset',
  'planned_transaction',
  'plan',
  'category',
  'user_setting',
  'two_factor',
  'user',
] as const

function runStatements(sqlite: Database, sql: string): void {
  for (const statement of sql.split(';')) {
    const trimmed = statement.trim()
    if (trimmed) sqlite.run(trimmed)
  }
}

export interface TestDb {
  sqlite: Database
  db: ReturnType<typeof createDrizzle>
  reset: () => void
  close: () => void
}

function createDrizzle(sqlite: Database) {
  return drizzle({
    client: sqlite,
    schema: {
      ...authSchema,
      ...plansSchema,
      ...settingsSchema,
      ...userRelationsSchema,
    },
  })
}

declare global {
  // eslint-disable-next-line no-var
  var __dimetimeTestDb: TestDb | undefined
}

export function createTestDb(): TestDb {
  if (globalThis.__dimetimeTestDb) return globalThis.__dimetimeTestDb
  const sqlite = new Database(':memory:')
  sqlite.run('PRAGMA foreign_keys = ON;')
  runStatements(sqlite, DDL)
  const db = createDrizzle(sqlite)

  globalThis.__dimetimeTestDb = {
    sqlite,
    db,
    reset: () => {
      for (const table of TRUNCATE_ORDER) {
        sqlite.run(`DELETE FROM "${table}"`)
      }
    },
    close: () => {
      // No-op: closing would break sibling test files that share this singleton.
      // The process exits when the runner finishes, releasing the in-memory DB.
    },
  }
  return globalThis.__dimetimeTestDb
}
