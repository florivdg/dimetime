import { beforeEach, describe, expect, it } from 'bun:test'
import { eq } from 'drizzle-orm'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { apiKey } from '@better-auth/api-key'
import * as authSchema from '@/db/schema/auth'
import { seedUser as seedUserRow } from '@/lib/__fixtures__/seeds'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'

const testDb = setupTestDb()

/**
 * Real `betterAuth` instance wired to the in-memory test database.
 *
 * The plugin options mirror `src/lib/auth.ts` on purpose: this suite exists to
 * prove that the official `@better-auth/api-key` plugin can read and write the
 * Drizzle `apikey` table declared in `src/db/schema/auth.ts`, so the options
 * must match what production uses.
 */
const auth = betterAuth({
  database: drizzleAdapter(testDb, {
    provider: 'sqlite',
    schema: authSchema,
  }),
  appName: 'DimeTime',
  secret: 'test-secret-for-api-key-integration-tests',
  plugins: [
    apiKey({
      enableSessionForAPIKeys: true,
      requireName: true,
      defaultPrefix: 'dt_',
      rateLimit: {
        enabled: true,
        timeWindow: 60_000,
        maxRequests: 100,
      },
    }),
  ],
})

const userId = 'u-1'

function apiKeyHeaders(key: string): Headers {
  return new Headers({ 'x-api-key': key })
}

function createKey(name = 'Test') {
  return auth.api.createApiKey({ body: { name, userId } })
}

/** `getSession` either resolves to `null` or throws for a key it rejects. */
async function resolveSessionOrNull(key: string) {
  try {
    return await auth.api.getSession({ headers: apiKeyHeaders(key) })
  } catch {
    return null
  }
}

beforeEach(async () => {
  await seedUserRow(testDb, {
    id: userId,
    name: 'Tester',
    email: 'tester@example.com',
  })
})

describe('api-key plugin ↔ Drizzle schema', () => {
  it('creates a key with the dt_ prefix and persists it in the apikey table', async () => {
    const created = await createKey()

    expect(created.key.startsWith('dt_')).toBe(true)
    expect(created.name).toBe('Test')
    expect(created.referenceId).toBe(userId)

    const rows = await testDb
      .select()
      .from(authSchema.apikey)
      .where(eq(authSchema.apikey.id, created.id))

    expect(rows).toHaveLength(1)
    const row = rows[0]!
    expect(row.name).toBe('Test')
    expect(row.referenceId).toBe(userId)
    expect(row.prefix).toBe('dt_')
    expect(row.start).toBe(created.key.slice(0, 6))
    expect(row.configId).toBe('default')
    expect(row.enabled).toBe(true)
    expect(row.rateLimitEnabled).toBe(true)
    expect(row.rateLimitTimeWindow).toBe(60_000)
    expect(row.rateLimitMax).toBe(100)
    expect(row.requestCount).toBe(0)
    expect(row.createdAt).toBeInstanceOf(Date)
    expect(row.updatedAt).toBeInstanceOf(Date)
  })

  it('stores the key hashed, never in plaintext', async () => {
    const { key } = await createKey()

    const rows = await testDb.select().from(authSchema.apikey)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.key).not.toBe(key)
    expect(rows[0]!.key).not.toContain(key)
  })
})

describe('api-key session resolution', () => {
  it('resolves a session for a valid key passed as x-api-key', async () => {
    const { key } = await createKey()

    const session = await auth.api.getSession({ headers: apiKeyHeaders(key) })

    expect(session).not.toBeNull()
    expect(session?.user.id).toBe(userId)
  })

  it('does not resolve a session for an unknown key of plausible length', async () => {
    const { key } = await createKey()
    const wrongKey = `dt_${'a'.repeat(key.length - 3)}`
    expect(wrongKey.length).toBe(key.length)

    expect(await resolveSessionOrNull(wrongKey)).toBeNull()
  })

  it('does not resolve a session for a too-short key', async () => {
    expect(await resolveSessionOrNull('dt_short')).toBeNull()
  })

  it('stops resolving a session once the key row is revoked', async () => {
    const { id, key } = await createKey()

    const before = await auth.api.getSession({ headers: apiKeyHeaders(key) })
    expect(before?.user.id).toBe(userId)

    await testDb.delete(authSchema.apikey).where(eq(authSchema.apikey.id, id))

    expect(await resolveSessionOrNull(key)).toBeNull()
  })
})

describe('listApiKeys', () => {
  it('lists the key metadata without ever exposing the plaintext key', async () => {
    const { id, key } = await createKey('Mein Schlüssel')

    const listed = await auth.api.listApiKeys({ headers: apiKeyHeaders(key) })

    expect(listed.apiKeys).toHaveLength(1)
    const entry = listed.apiKeys[0]!
    expect(entry.id).toBe(id)
    expect(entry.name).toBe('Mein Schlüssel')
    expect(entry.start).toBe(key.slice(0, 6))
    expect(JSON.stringify(listed)).not.toContain(key)
  })
})
