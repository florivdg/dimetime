import { afterAll, beforeEach, mock } from 'bun:test'
import { createTestDb } from './test-db'

export type TestDatabase = ReturnType<typeof createTestDb>['db']

/**
 * Standard `bun:test` database setup for lib + API route tests.
 *
 * Wires the in-memory test database into `@/db/database` (so production code
 * under test uses it), resets all tables before each test, and closes the
 * harness after the file finishes. Returns the Drizzle handle for seeding and
 * assertions.
 *
 * Call this at module top-level *before* dynamically importing the module under
 * test — `mock.module` applies at call time, so the import must come after.
 */
export function setupTestDb(): TestDatabase {
  const harness = createTestDb()

  void mock.module('@/db/database', () => ({
    db: harness.db,
  }))

  beforeEach(() => {
    harness.reset()
  })

  afterAll(() => {
    harness.close()
  })

  return harness.db
}

/**
 * Wipe all tables mid-test. Use when a test seeded by a shared `beforeEach`
 * needs to start from an empty database with a different fixture set.
 */
export function resetTestDb(): void {
  createTestDb().reset()
}
