import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as authSchema from '@/db/schema/auth'
import { createTestDb } from '@/lib/__fixtures__/test-db'
import { buildApiContext } from '@/lib/__fixtures__/api-context'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const { GET, PUT } = await import('./index')

const now = new Date('2026-03-09T00:00:00.000Z')
const userId = 'user-1'

async function seedUser() {
  await testDb.insert(authSchema.user).values({
    id: userId,
    name: 'A',
    email: 'a@example.com',
    createdAt: now,
    updatedAt: now,
  })
}

beforeEach(async () => {
  harness.reset()
  await seedUser()
})

afterAll(() => {
  harness.close()
})

describe('GET /api/settings', () => {
  it('returns 401 when no user', async () => {
    const res = (await GET(buildApiContext() as never)) as Response
    expect(res.status).toBe(401)
  })

  it('returns defaults when no settings stored', async () => {
    const res = (await GET(buildApiContext({ userId }) as never)) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.themePreference).toBe('system')
    expect(body.groupTransactionsByType).toBe(false)
  })
})

describe('PUT /api/settings', () => {
  it('returns 401 when no user', async () => {
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { themePreference: 'dark' },
      }) as never,
    )) as Response
    expect(res.status).toBe(401)
  })

  it('rejects invalid body', async () => {
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { themePreference: 'neon' },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('updates settings and returns merged result', async () => {
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { themePreference: 'dark', groupTransactionsByType: true },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.themePreference).toBe('dark')
    expect(body.groupTransactionsByType).toBe(true)
  })
})
