import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'

const sqlite = new Database(process.env.DB_FILE_NAME!)

// Enable foreign key constraints
sqlite.run('PRAGMA foreign_keys = ON;')

// Enable write ahead logging for better concurrency
sqlite.run('PRAGMA journal_mode = WAL;')

const db = drizzle({ client: sqlite })

export { db }
