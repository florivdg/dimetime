import { describe, expect, it } from 'bun:test'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import { seedBankTransaction, seedImportSource } from '@/lib/__fixtures__/seeds'

const testDb = setupTestDb()

const { GET } = await import('./index')

async function seed() {
  await seedImportSource(testDb, { id: 'src-1' })
  await seedBankTransaction(testDb, {
    id: 'bt-1',
    sourceId: 'src-1',
    amountCents: -1000,
  })
}

describe('GET /api/bank-transactions', () => {
  it('returns empty when no rows', async () => {
    const res = (await GET(buildApiContext() as never)) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rows).toEqual([])
  })

  it('returns rows after seeding', async () => {
    await seed()
    const res = (await GET(buildApiContext() as never)) as Response
    const body = await res.json()
    expect(body.rows).toHaveLength(1)
  })

  it('rejects invalid query (status enum)', async () => {
    const res = (await GET(
      buildApiContext({
        url: 'http://test/api/bank-transactions?status=bogus',
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })
})
