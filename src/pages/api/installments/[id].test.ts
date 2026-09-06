import { beforeEach, describe, expect, it } from 'bun:test'
import { eq } from 'drizzle-orm'
import { installmentPlan, plannedTransaction } from '@/db/schema/plans'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'
import { buildApiContext } from '@/lib/__fixtures__/api-context'
import { itGuardsIdRoute } from '@/lib/__fixtures__/route-guards'
import {
  seedInstallmentPlan,
  seedPlan,
  seedPlannedTransaction,
  seedUser,
} from '@/lib/__fixtures__/seeds'

const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999'

const testDb = setupTestDb()

const { PUT, DELETE } = await import('./[id]')

const userId = '11111111-1111-4111-8111-111111111111'
const installmentId = 'ip1'
const planId = 'plan-2026-03'

async function seedInstallment() {
  await seedPlan(testDb, { id: planId, date: '2026-03-01' })
  await seedInstallmentPlan(testDb, {
    id: installmentId,
    name: 'Sofa',
    amount: 5000,
    totalInstallments: 12,
    startMonth: '2026-03',
    userId,
  })
  await seedPlannedTransaction(testDb, {
    id: 'row-open',
    name: 'Sofa',
    amount: 5000,
    dueDate: '2026-03-01',
    planId,
    installmentId,
  })
}

async function linkedRows() {
  return testDb
    .select()
    .from(plannedTransaction)
    .where(eq(plannedTransaction.installmentId, installmentId))
}

beforeEach(async () => {
  await seedUser(testDb, { id: userId, name: 'A', email: 'a@example.com' })
})

describe('PUT /api/installments/[id]', () => {
  itGuardsIdRoute(PUT, {
    method: 'PUT',
    body: { name: 'X' },
    unknownId: UNKNOWN_ID,
    notFoundName: 'returns 404 when installment not found',
  })

  it('returns the German not-found message', async () => {
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { name: 'X' },
        params: { id: UNKNOWN_ID },
      }) as never,
    )) as Response
    expect((await res.json()).error).toBe('Ratenzahlung nicht gefunden')
  })

  it('rejects an invalid body', async () => {
    await seedInstallment()
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { amount: 0 },
        params: { id: installmentId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it('rejects prepaid > total when only prepaid is sent', async () => {
    await seedInstallment()
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { prepaidInstallments: 999 },
        params: { id: installmentId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(
      'Bereits gezahlte Raten dürfen die Gesamtanzahl nicht überschreiten',
    )

    const [stored] = await testDb
      .select()
      .from(installmentPlan)
      .where(eq(installmentPlan.id, installmentId))
    expect(stored.prepaidInstallments).toBe(0)
  })

  it('rejects lowering the total below the stored prepaid count', async () => {
    await seedInstallment()
    await testDb
      .update(installmentPlan)
      .set({ prepaidInstallments: 5 })
      .where(eq(installmentPlan.id, installmentId))

    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { totalInstallments: 3 },
        params: { id: installmentId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(
      'Bereits gezahlte Raten dürfen die Gesamtanzahl nicht überschreiten',
    )
  })

  it('rejects a final rate on a single-installment plan', async () => {
    await seedInstallment()
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { totalInstallments: 1, finalAmount: 4735 },
        params: { id: installmentId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(
      'Eine abweichende Schlussrate ist erst ab zwei Raten möglich',
    )
  })

  it('rejects lowering the total below two while a final rate is stored', async () => {
    await seedInstallment()
    await testDb
      .update(installmentPlan)
      .set({ finalAmount: 4735 })
      .where(eq(installmentPlan.id, installmentId))

    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { totalInstallments: 1 },
        params: { id: installmentId },
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(
      'Eine abweichende Schlussrate ist erst ab zwei Raten möglich',
    )
  })

  it('allows clearing the final rate together with a lowered total', async () => {
    await seedInstallment()
    await testDb
      .update(installmentPlan)
      .set({ finalAmount: 4735 })
      .where(eq(installmentPlan.id, installmentId))

    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { totalInstallments: 1, finalAmount: null },
        params: { id: installmentId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)

    const [stored] = await testDb
      .select()
      .from(installmentPlan)
      .where(eq(installmentPlan.id, installmentId))
    expect(stored.finalAmount).toBeNull()
  })

  it('rejects a nonexistent month', async () => {
    await seedInstallment()
    for (const startMonth of ['2026-00', '2026-13']) {
      const res = (await PUT(
        buildApiContext({
          method: 'PUT',
          body: { startMonth },
          params: { id: installmentId },
        }) as never,
      )) as Response
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe(
        'Ungültiges Monatsformat (erwartet: JJJJ-MM)',
      )
    }
  })

  it('updates and returns the stored installment row', async () => {
    await seedInstallment()
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { name: 'Couch' },
        params: { id: installmentId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Couch')
    expect(body.totalInstallments).toBe(12)
  })

  it('reprices the open linked rows when the rate changes', async () => {
    await seedInstallment()
    const res = (await PUT(
      buildApiContext({
        method: 'PUT',
        body: { amount: 6000 },
        params: { id: installmentId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)

    const rows = await linkedRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toBe(6000)
  })
})

describe('DELETE /api/installments/[id]', () => {
  itGuardsIdRoute(DELETE, {
    method: 'DELETE',
    unknownId: UNKNOWN_ID,
    notFoundName: 'returns 404 when installment not found',
  })

  it('deletes the installment and removes its open rows', async () => {
    await seedInstallment()
    await seedPlannedTransaction(testDb, {
      id: 'row-done',
      name: 'Sofa',
      amount: 5000,
      dueDate: '2026-02-01',
      isDone: true,
      installmentId,
    })

    const res = (await DELETE(
      buildApiContext({
        method: 'DELETE',
        params: { id: installmentId },
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)

    const remaining = await testDb
      .select()
      .from(installmentPlan)
      .where(eq(installmentPlan.id, installmentId))
    expect(remaining).toHaveLength(0)

    // Checked rows survive with a cleared back-reference, open rows are gone
    const rows = await testDb.select().from(plannedTransaction)
    expect(rows.map((row) => row.id)).toEqual(['row-done'])
    expect(rows[0].installmentId).toBeNull()
  })
})
