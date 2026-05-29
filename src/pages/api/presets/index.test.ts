import { beforeEach, describe, expect, it } from 'bun:test'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import {
  getExpectOkBody,
  postExpectCreated,
  postExpectStatus,
} from '@/lib/__fixtures__/bulk-route-assertions'
import { seedUser } from '@/lib/__fixtures__/seeds'
import { seedScopedPreset } from '@/lib/__fixtures__/route-guards-user'

const testDb = setupTestDb()

const { GET, POST } = await import('./index')

const userId = '11111111-1111-4111-8111-111111111111'

beforeEach(async () => {
  await seedUser(testDb, { id: userId, name: 'A', email: 'a@example.com' })
})

describe('GET /api/presets', () => {
  it('returns 401 without user', async () => {
    const res = (await GET(buildApiContext() as never)) as Response
    expect(res.status).toBe(401)
  })

  it('returns paginated presets for the user', async () => {
    await seedScopedPreset(
      testDb,
      '11111111-1111-4111-8111-aaaaaaaaaaaa',
      userId,
    )
    const body = await getExpectOkBody(GET, userId)
    expect(body.presets).toHaveLength(1)
  })

  it('rejects invalid query (limit out of range)', async () => {
    const res = (await GET(
      buildApiContext({
        userId,
        url: 'http://test/api/presets?limit=500',
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })
})

describe('POST /api/presets', () => {
  it('returns 401 without user', async () => {
    await postExpectStatus(POST, { body: { name: 'X', amount: 100 } }, 401)
  })

  it('rejects invalid body', async () => {
    await postExpectStatus(POST, { body: {}, userId }, 400)
  })

  it('creates and returns 201', async () => {
    const body = await postExpectCreated(POST, {
      body: { name: 'Rent', amount: 1000 },
      userId,
    })
    expect(body.name).toBe('Rent')
  })
})
