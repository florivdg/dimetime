import { relations } from 'drizzle-orm'
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { user } from './auth'

export const category = sqliteTable(
  'category',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    slug: text('slug').notNull(), // URL-friendly identifier (e.g., "miete", "lebensmittel")
    color: text('color'), // Hex color for UI display
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('category_name_idx').on(table.name),
    uniqueIndex('category_slug_idx').on(table.slug),
  ],
)

export const plan = sqliteTable(
  'plan',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name'), // Optional custom title
    date: text('date').notNull(), // YYYY-MM-DD format
    notes: text('notes'),
    isArchived: integer('is_archived', { mode: 'boolean' })
      .default(false)
      .notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('plan_date_idx').on(table.date)],
)

export const plannedTransaction = sqliteTable(
  'planned_transaction',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    note: text('note'), // Longer description
    type: text('type', { enum: ['income', 'expense'] })
      .notNull()
      .default('expense'),
    dueDate: text('due_date').notNull(), // YYYY-MM-DD format
    amount: integer('amount').notNull().default(0), // Cents (e.g., 1234 = €12.34)
    isDone: integer('is_done', { mode: 'boolean' }).default(false).notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }), // When marked done
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
    planId: text('plan_id').references(() => plan.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    categoryId: text('category_id').references(() => category.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('plannedTransaction_planId_idx').on(table.planId),
    index('plannedTransaction_userId_idx').on(table.userId),
    index('plannedTransaction_dueDate_idx').on(table.dueDate),
    index('plannedTransaction_categoryId_idx').on(table.categoryId),
    index('plannedTransaction_type_idx').on(table.type),
  ],
)

export const categoryRelations = relations(category, ({ many }) => ({
  transactions: many(plannedTransaction),
}))

export const planRelations = relations(plan, ({ many }) => ({
  transactions: many(plannedTransaction),
  kassensturzDismissals: many(kassensturzDismissal),
  kassensturzManualEntries: many(kassensturzManualEntry),
}))

export const plannedTransactionRelations = relations(
  plannedTransaction,
  ({ one, many }) => ({
    plan: one(plan, {
      fields: [plannedTransaction.planId],
      references: [plan.id],
    }),
    user: one(user, {
      fields: [plannedTransaction.userId],
      references: [user.id],
    }),
    category: one(category, {
      fields: [plannedTransaction.categoryId],
      references: [category.id],
    }),
    reconciliations: many(transactionReconciliation),
    kassensturzManualEntries: many(kassensturzManualEntry),
  }),
)

// Bank Import Sources
export const importSource = sqliteTable(
  'import_source',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    preset: text('preset', {
      enum: ['ing_csv_v1', 'easybank_xlsx_v1'],
    }).notNull(),
    sourceKind: text('source_kind', {
      enum: ['bank_account', 'credit_card', 'other'],
    }).notNull(),
    bankName: text('bank_name'),
    accountLabel: text('account_label'),
    accountIdentifier: text('account_identifier'),
    defaultPlanAssignment: text('default_plan_assignment', {
      enum: ['auto_month', 'none'],
    })
      .notNull()
      .default('auto_month'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('importSource_preset_idx').on(table.preset),
    index('importSource_isActive_idx').on(table.isActive),
  ],
)

// Statement Import Runs
export const statementImport = sqliteTable(
  'statement_import',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceId: text('source_id')
      .notNull()
      .references(() => importSource.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    fileSha256: text('file_sha256').notNull(),
    fileType: text('file_type', { enum: ['csv', 'xlsx'] }).notNull(),
    phase: text('phase', { enum: ['preview', 'commit'] }).notNull(),
    status: text('status', { enum: ['success', 'failed'] }).notNull(),
    previewCount: integer('preview_count').notNull().default(0),
    importedCount: integer('imported_count').notNull().default(0),
    updatedCount: integer('updated_count').notNull().default(0),
    skippedCount: integer('skipped_count').notNull().default(0),
    errorMessage: text('error_message'),
    triggeredByUserId: text('triggered_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('statementImport_sourceId_idx').on(table.sourceId),
    index('statementImport_fileSha256_idx').on(table.fileSha256),
    index('statementImport_createdAt_idx').on(table.createdAt),
  ],
)

// Imported Bank/Credit-Card Transactions
export const bankTransaction = sqliteTable(
  'bank_transaction',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceId: text('source_id')
      .notNull()
      .references(() => importSource.id, { onDelete: 'cascade' }),
    firstSeenImportId: text('first_seen_import_id').references(
      () => statementImport.id,
      {
        onDelete: 'set null',
      },
    ),
    lastSeenImportId: text('last_seen_import_id').references(
      () => statementImport.id,
      {
        onDelete: 'set null',
      },
    ),
    externalTransactionId: text('external_transaction_id'),
    dedupeKey: text('dedupe_key').notNull(),
    bookingDate: text('booking_date').notNull(), // YYYY-MM-DD
    valueDate: text('value_date'), // YYYY-MM-DD
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default('EUR'),
    originalAmountCents: integer('original_amount_cents'),
    originalCurrency: text('original_currency'),
    counterparty: text('counterparty'),
    bookingText: text('booking_text'),
    description: text('description'),
    purpose: text('purpose'),
    status: text('status', { enum: ['booked', 'pending', 'unknown'] })
      .notNull()
      .default('unknown'),
    balanceAfterCents: integer('balance_after_cents'),
    balanceCurrency: text('balance_currency'),
    country: text('country'),
    cardLast4: text('card_last4'),
    cardholder: text('cardholder'),
    rawDataJson: text('raw_data_json').notNull(),
    planId: text('plan_id').references(() => plan.id, { onDelete: 'set null' }),
    planAssignment: text('plan_assignment', {
      enum: ['auto_month', 'manual', 'none'],
    })
      .notNull()
      .default('none'),
    importSeenCount: integer('import_seen_count').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('bankTransaction_sourceId_dedupeKey_idx').on(
      table.sourceId,
      table.dedupeKey,
    ),
    index('bankTransaction_bookingDate_idx').on(table.bookingDate),
    index('bankTransaction_planId_idx').on(table.planId),
    index('bankTransaction_status_idx').on(table.status),
    index('bankTransaction_externalTransactionId_idx').on(
      table.externalTransactionId,
    ),
  ],
)

// Link between imported and planned transactions (future automatic matching)
export const transactionReconciliation = sqliteTable(
  'transaction_reconciliation',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bankTransactionId: text('bank_transaction_id')
      .notNull()
      .references(() => bankTransaction.id, { onDelete: 'cascade' }),
    plannedTransactionId: text('planned_transaction_id')
      .notNull()
      .references(() => plannedTransaction.id, { onDelete: 'cascade' }),
    matchType: text('match_type', { enum: ['manual', 'auto'] })
      .notNull()
      .default('manual'),
    confidence: integer('confidence'),
    matchedAt: integer('matched_at', { mode: 'timestamp_ms' }).notNull(),
    matchedByUserId: text('matched_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    uniqueIndex('transactionReconciliation_bankTransactionId_idx').on(
      table.bankTransactionId,
    ),
    index('transactionReconciliation_plannedTransactionId_idx').on(
      table.plannedTransactionId,
    ),
  ],
)

// Transaction Presets
export const transactionPreset = sqliteTable(
  'transaction_preset',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    note: text('note'),
    type: text('type', { enum: ['income', 'expense'] })
      .notNull()
      .default('expense'),
    amount: integer('amount').notNull().default(0), // Cents
    recurrence: text('recurrence', {
      enum: ['einmalig', 'monatlich', 'vierteljährlich', 'jährlich'],
    })
      .notNull()
      .default('einmalig'),
    startMonth: text('start_month'), // YYYY-MM format, defines when recurrence starts
    endDate: text('end_date'), // YYYY-MM-DD, nullable
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => category.id, {
      onDelete: 'set null',
    }),
    dayOfMonth: integer('day_of_month'), // 1-31, nullable; overrides plan date when applying
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('transactionPreset_userId_idx').on(table.userId),
    index('transactionPreset_categoryId_idx').on(table.categoryId),
    index('transactionPreset_type_idx').on(table.type),
    index('transactionPreset_recurrence_idx').on(table.recurrence),
  ],
)

// Kassensturz: dismissed bank transactions (per plan)
export const kassensturzDismissal = sqliteTable(
  'kassensturz_dismissal',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bankTransactionId: text('bank_transaction_id')
      .notNull()
      .references(() => bankTransaction.id, { onDelete: 'cascade' }),
    planId: text('plan_id')
      .notNull()
      .references(() => plan.id, { onDelete: 'cascade' }),
    reason: text('reason'),
    dismissedAt: integer('dismissed_at', { mode: 'timestamp_ms' }).notNull(),
    dismissedByUserId: text('dismissed_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    uniqueIndex('kassensturzDismissal_bankTx_plan_idx').on(
      table.bankTransactionId,
      table.planId,
    ),
    index('kassensturzDismissal_planId_idx').on(table.planId),
  ],
)

// Kassensturz: manual balance entries (cash, PayPal, etc.)
export const kassensturzManualEntry = sqliteTable(
  'kassensturz_manual_entry',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    planId: text('plan_id')
      .notNull()
      .references(() => plan.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    note: text('note'),
    amountCents: integer('amount_cents').notNull(),
    type: text('type', { enum: ['income', 'expense'] })
      .notNull()
      .default('expense'),
    plannedTransactionId: text('planned_transaction_id').references(
      () => plannedTransaction.id,
      { onDelete: 'set null' },
    ),
    createdByUserId: text('created_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('kassensturzManualEntry_planId_idx').on(table.planId),
    index('kassensturzManualEntry_plannedTransactionId_idx').on(
      table.plannedTransactionId,
    ),
  ],
)

// Relations
export const transactionPresetRelations = relations(
  transactionPreset,
  ({ one }) => ({
    user: one(user, {
      fields: [transactionPreset.userId],
      references: [user.id],
    }),
    category: one(category, {
      fields: [transactionPreset.categoryId],
      references: [category.id],
    }),
  }),
)

export const importSourceRelations = relations(importSource, ({ many }) => ({
  statementImports: many(statementImport),
  bankTransactions: many(bankTransaction),
}))

export const statementImportRelations = relations(
  statementImport,
  ({ one }) => ({
    source: one(importSource, {
      fields: [statementImport.sourceId],
      references: [importSource.id],
    }),
    triggeredByUser: one(user, {
      fields: [statementImport.triggeredByUserId],
      references: [user.id],
    }),
  }),
)

export const bankTransactionRelations = relations(
  bankTransaction,
  ({ one }) => ({
    source: one(importSource, {
      fields: [bankTransaction.sourceId],
      references: [importSource.id],
    }),
    firstSeenImport: one(statementImport, {
      fields: [bankTransaction.firstSeenImportId],
      references: [statementImport.id],
    }),
    lastSeenImport: one(statementImport, {
      fields: [bankTransaction.lastSeenImportId],
      references: [statementImport.id],
    }),
    plan: one(plan, {
      fields: [bankTransaction.planId],
      references: [plan.id],
    }),
  }),
)

export const transactionReconciliationRelations = relations(
  transactionReconciliation,
  ({ one }) => ({
    bankTransaction: one(bankTransaction, {
      fields: [transactionReconciliation.bankTransactionId],
      references: [bankTransaction.id],
    }),
    plannedTransaction: one(plannedTransaction, {
      fields: [transactionReconciliation.plannedTransactionId],
      references: [plannedTransaction.id],
    }),
    matchedByUser: one(user, {
      fields: [transactionReconciliation.matchedByUserId],
      references: [user.id],
    }),
  }),
)

export const kassensturzDismissalRelations = relations(
  kassensturzDismissal,
  ({ one }) => ({
    bankTransaction: one(bankTransaction, {
      fields: [kassensturzDismissal.bankTransactionId],
      references: [bankTransaction.id],
    }),
    plan: one(plan, {
      fields: [kassensturzDismissal.planId],
      references: [plan.id],
    }),
    dismissedByUser: one(user, {
      fields: [kassensturzDismissal.dismissedByUserId],
      references: [user.id],
    }),
  }),
)

export const kassensturzManualEntryRelations = relations(
  kassensturzManualEntry,
  ({ one }) => ({
    plan: one(plan, {
      fields: [kassensturzManualEntry.planId],
      references: [plan.id],
    }),
    plannedTransaction: one(plannedTransaction, {
      fields: [kassensturzManualEntry.plannedTransactionId],
      references: [plannedTransaction.id],
    }),
    createdByUser: one(user, {
      fields: [kassensturzManualEntry.createdByUserId],
      references: [user.id],
    }),
  }),
)
