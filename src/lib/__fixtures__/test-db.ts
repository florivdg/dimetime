import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import {
  generateSQLiteDrizzleJson,
  generateSQLiteMigration,
} from 'drizzle-kit/api'
import * as authSchema from '@/db/schema/auth'
import * as plansSchema from '@/db/schema/plans'
import * as settingsSchema from '@/db/schema/settings'
import * as userRelationsSchema from '@/db/schema/user-relations'

const schema = {
  ...authSchema,
  ...plansSchema,
  ...settingsSchema,
  ...userRelationsSchema,
}

// DDL is generated from the Drizzle schema, so the test DB cannot drift from it.
// drizzle-kit/api is semi-public: if it breaks, every DB test fails loudly at boot.
const DDL_STATEMENTS = await generateSQLiteMigration(
  await generateSQLiteDrizzleJson({}),
  await generateSQLiteDrizzleJson(schema),
)
if (DDL_STATEMENTS.length === 0)
  throw new Error(
    'drizzle-kit/api returned no DDL statements for the test schema',
  )

export interface TestDb {
  sqlite: Database
  db: ReturnType<typeof createDrizzle>
  reset: () => void
  close: () => void
}

function createDrizzle(sqlite: Database) {
  return drizzle({ client: sqlite, schema })
}

declare global {
  // eslint-disable-next-line no-var
  var __dimetimeTestDb: TestDb | undefined
}

export function createTestDb(): TestDb {
  if (globalThis.__dimetimeTestDb) return globalThis.__dimetimeTestDb
  const sqlite = new Database(':memory:')
  sqlite.run('PRAGMA foreign_keys = ON;')
  for (const statement of DDL_STATEMENTS) sqlite.run(statement)
  const tables = sqlite
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )
    .all()
    .map((row) => row.name)
  const db = createDrizzle(sqlite)

  globalThis.__dimetimeTestDb = {
    sqlite,
    db,
    reset: () => {
      sqlite.run('PRAGMA foreign_keys = OFF')
      try {
        for (const table of tables) sqlite.run(`DELETE FROM "${table}"`)
      } finally {
        sqlite.run('PRAGMA foreign_keys = ON')
      }
    },
    close: () => {
      // No-op: closing would break sibling test files that share this singleton.
      // The process exits when the runner finishes, releasing the in-memory DB.
    },
  }
  return globalThis.__dimetimeTestDb
}
