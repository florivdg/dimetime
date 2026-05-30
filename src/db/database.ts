import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as authSchema from './schema/auth'
import * as plansSchema from './schema/plans'
import * as settingsSchema from './schema/settings'
import * as userRelationsSchema from './schema/user-relations'

function createDb() {
  const sqlite = new Database(process.env.DB_FILE_NAME!)

  sqlite.run('PRAGMA foreign_keys = ON;')

  // Use exclusive locking to avoid -shm file (required for Docker volumes that
  // don't support mmap). Skipped in dev because Vite HMR re-evaluates this
  // module and a second connection would deadlock against the held lock.
  if (import.meta.env.PROD) {
    sqlite.run('PRAGMA locking_mode = EXCLUSIVE;')
  }

  sqlite.run('PRAGMA journal_mode = WAL;')

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

type Db = ReturnType<typeof createDb>

declare global {
  // eslint-disable-next-line no-var
  var __dimetimeDb: Db | undefined
}

// Cache on globalThis so HMR re-execution reuses the same connection
// instead of opening a new one against the held SQLite lock.
const db: Db = globalThis.__dimetimeDb ?? (globalThis.__dimetimeDb = createDb())

export type DbOrTransaction =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0]

export { db }
