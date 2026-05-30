import { beforeEach, describe, expect, it } from 'bun:test'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import { seedUser } from '@/lib/__fixtures__/seeds'

const testDb = setupTestDb()

const { GET, PUT } = await import('./index')

const userId = 'user-1'

beforeEach(async () => {
  await seedUser(testDb, { id: userId, name: 'A', email: 'a@example.com' })
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
