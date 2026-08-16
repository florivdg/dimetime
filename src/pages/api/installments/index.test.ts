import { beforeEach, describe, expect, it } from 'bun:test'
import { eq } from 'drizzle-orm'
import { plannedTransaction } from '@/db/schema/plans'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import {
  postExpectCreated,
  postExpectStatus,
} from '@/lib/__fixtures__/bulk-route-assertions'
import { seedPlan, seedUser } from '@/lib/__fixtures__/seeds'

const testDb = setupTestDb()

const { POST } = await import('./index')

const userId = '11111111-1111-4111-8111-111111111111'
const planId = '22222222-2222-4222-8222-222222222222'

const validBody = {
  name: 'Sofa',
  amount: 5000,
  totalInstallments: 12,
  startMonth: '2026-03',
}

async function postBody(body: unknown): Promise<Response> {
  return (await POST(
    buildApiContext({ method: 'POST', body, userId }) as never,
  )) as Response
}

async function expectMessage(body: unknown, message: string): Promise<void> {
  const res = await postBody(body)
  expect(res.status).toBe(400)
  expect((await res.json()).error).toBe(message)
}

beforeEach(async () => {
  await seedUser(testDb, { id: userId, name: 'A', email: 'a@example.com' })
})

describe('POST /api/installments', () => {
  it('returns 401 without user', async () => {
    await postExpectStatus(POST, { body: validBody }, 401)
  })

  it('rejects an empty body', async () => {
    await postExpectStatus(POST, { body: {}, userId }, 400)
  })

  it('rejects an invalid start month', async () => {
    await expectMessage(
      { ...validBody, startMonth: '2026-03-01' },
      'Ungültiges Monatsformat (erwartet: JJJJ-MM)',
    )
  })

  it('rejects a nonexistent month', async () => {
    for (const startMonth of ['2026-00', '2026-13']) {
      await expectMessage(
        { ...validBody, startMonth },
        'Ungültiges Monatsformat (erwartet: JJJJ-MM)',
      )
    }
  })

  it('rejects an amount of zero', async () => {
    await expectMessage(
      { ...validBody, amount: 0 },
      'Betrag muss größer als 0 sein',
    )
  })

  it('rejects more prepaid than total installments', async () => {
    await expectMessage(
      { ...validBody, prepaidInstallments: 13 },
      'Bereits gezahlte Raten dürfen die Gesamtanzahl nicht überschreiten',
    )
  })

  it('creates the installment and returns 201 with the stored row', async () => {
    const body = await postExpectCreated(POST, { body: validBody, userId })
    expect(body.name).toBe('Sofa')
    expect(body.totalInstallments).toBe(12)
    expect(body.startMonth).toBe('2026-03')
    expect(body.userId).toBe(userId)
  })

  it('materializes the installment into an existing plan', async () => {
    await seedPlan(testDb, { id: planId, date: '2026-03-01' })
    await postExpectCreated(POST, {
      body: { ...validBody, dayOfMonth: 15 },
      userId,
    })

    const rows = await testDb
      .select()
      .from(plannedTransaction)
      .where(eq(plannedTransaction.planId, planId))

    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Sofa')
    expect(rows[0].amount).toBe(5000)
    expect(rows[0].type).toBe('expense')
    expect(rows[0].dueDate).toBe('2026-03-15')
    expect(rows[0].userId).toBe(userId)
  })
})
