import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as authSchema from './schema/auth'
import * as plansSchema from './schema/plans'
import * as settingsSchema from './schema/settings'

const sqlite = new Database(process.env.DB_FILE_NAME!)

// Enable foreign key constraints
sqlite.run('PRAGMA foreign_keys = ON;')

// Use exclusive locking to avoid -shm file (required for Docker volumes that don't support mmap)
sqlite.run('PRAGMA locking_mode = EXCLUSIVE;')

// Enable write ahead logging for better concurrency
sqlite.run('PRAGMA journal_mode = WAL;')

const db = drizzle({
  client: sqlite,
  schema: { ...authSchema, ...plansSchema, ...settingsSchema },
})

export type DbOrTransaction =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0]

export { db }
