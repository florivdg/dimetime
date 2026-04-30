import { relations } from 'drizzle-orm'
import { user, session, account, passkey, twoFactor } from './auth'
import { plannedTransaction } from './plans'
import { userSetting } from './settings'

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  passkeys: many(passkey),
  plannedTransactions: many(plannedTransaction),
  settings: many(userSetting),
  twoFactor: one(twoFactor),
}))
