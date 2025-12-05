import { relations } from 'drizzle-orm'
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { user } from './auth'

export const userSetting = sqliteTable(
  'user_setting',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('userSetting_userId_key_idx').on(table.userId, table.key),
  ],
)

export const userSettingRelations = relations(userSetting, ({ one }) => ({
  user: one(user, {
    fields: [userSetting.userId],
    references: [user.id],
  }),
}))
