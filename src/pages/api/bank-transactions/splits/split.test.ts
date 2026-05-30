import { beforeEach, describe, expect, it } from 'bun:test'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import { itGuardsIdRoute } from '@/lib/__fixtures__/route-guards'
import { seedBankTransaction, seedImportSource } from '@/lib/__fixtures__/seeds'

const testDb = setupTestDb()

const { POST, DELETE } = await import('../[id]/split')

const sourceId = 'src-1'
const btId = 'bt-1'

async function seed() {
  await seedImportSource(testDb, { id: sourceId })
  await seedBankTransaction(testDb, {
    id: btId,
    sourceId,
    amountCents: -2000,
  })
}

beforeEach(async () => {
  await seed()
})

describe('POST /api/bank-transactions/[id]/split', () => {
  itGuardsIdRoute(POST, {
    method: 'POST',
    body: { splits: [] },
    unknownId: 'missing',
    notFoundName: 'returns 404 when transaction not found',
  })

  it('returns 400 on invalid JSON', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        bodyText: '{bad',
        params: { id: btId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 400 for schema failure', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: { splits: [{ amountCents: -100 }] },
        params: { id: btId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('returns 400 when split validation throws', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: {
          splits: [{ amountCents: -1000 }, { amountCents: -2000 }],
        },
        params: { id: btId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('splits successfully', async () => {
    const res = (await POST(
      buildApiContext({
        method: 'POST',
        body: {
          splits: [{ amountCents: -1000 }, { amountCents: -1000 }],
        },
        params: { id: btId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.splits).toHaveLength(2)
  })
})

describe('DELETE /api/bank-transactions/[id]/split', () => {
  itGuardsIdRoute(DELETE, {
    method: 'DELETE',
    unknownId: 'missing',
    notFoundName: 'returns 404 when transaction not found',
  })

  it('returns 400 when not currently split', async () => {
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: btId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('unsplits successfully', async () => {
    await POST(
      buildApiContext({
        method: 'POST',
        body: {
          splits: [{ amountCents: -1000 }, { amountCents: -1000 }],
        },
        params: { id: btId },
      }) as never,
    )
    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: btId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
  })
})
