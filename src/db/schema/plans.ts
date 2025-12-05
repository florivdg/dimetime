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
}))

export const plannedTransactionRelations = relations(
  plannedTransaction,
  ({ one }) => ({
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
  }),
)
