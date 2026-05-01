import { integer, text } from 'drizzle-orm/sqlite-core'

export const timestamps = () => ({
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .$onUpdate(() => new Date())
    .notNull(),
})

export const transactionCoreColumns = () => ({
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  note: text('note'),
  type: text('type', { enum: ['income', 'expense'] })
    .notNull()
    .default('expense'),
  amount: integer('amount').notNull().default(0),
})
