import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as authSchema from './schema/auth'
import * as plansSchema from './schema/plans'

const sqlite = new Database(process.env.DB_FILE_NAME!)

// Enable foreign key constraints
sqlite.run('PRAGMA foreign_keys = ON;')

// Enable write ahead logging for better concurrency
sqlite.run('PRAGMA journal_mode = WAL;')

const db = drizzle({
  client: sqlite,
  schema: { ...authSchema, ...plansSchema },
})

export { db }
