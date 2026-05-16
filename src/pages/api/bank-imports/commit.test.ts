import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as authSchema from '@/db/schema/auth'
import * as plansSchema from '@/db/schema/plans'
import { createTestDb } from '@/lib/__fixtures__/test-db'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const { POST } = await import('./commit')

const now = new Date('2026-03-09T00:00:00.000Z')
const sourceId = 'src-1'

const SAMPLE_ING_CSV = [
  'Buchung;Wertstellungsdatum;Auftraggeber/Empfänger;Buchungstext;Verwendungszweck;Saldo;Währung;Betrag;Währung',
  '01.03.2026;02.03.2026;Edeka;Lastschrift;Einkauf;1500,00;EUR;-45,00;EUR',
].join('\n')

async function seedSource() {
  await testDb.insert(plansSchema.importSource).values({
    id: sourceId,
    name: 'ING',
    preset: 'ing_csv_v1',
    sourceKind: 'bank_account',
    defaultPlanAssignment: 'none',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })
}

async function seedUser() {
  await testDb.insert(authSchema.user).values({
    id: 'user-1',
    name: 'A',
    email: 'a@example.com',
    createdAt: now,
    updatedAt: now,
  })
}

function postFormData(form: Record<string, string | File>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(form)) fd.append(k, v)
  return new Request('http://test/api/bank-imports/commit', {
    method: 'POST',
    body: fd,
  })
}

beforeEach(async () => {
  harness.reset()
  await seedSource()
  await seedUser()
})

afterAll(() => {
  harness.close()
})

describe('POST /api/bank-imports/commit', () => {
  it('persists rows on success', async () => {
    const file = new File([SAMPLE_ING_CSV], 'statement.csv', {
      type: 'text/csv',
    })
    const res = (await POST({
      request: postFormData({ sourceId, file }),
      locals: { user: { id: 'user-1' } },
    } as never)) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.inserted).toBeGreaterThan(0)
    expect(body.importId).toBeTypeOf('string')
  })

  it('returns error response when parsing fails', async () => {
    const file = new File(['garbage'], 'statement.csv', { type: 'text/csv' })
    const res = (await POST({
      request: postFormData({ sourceId, file }),
      locals: {},
    } as never)) as Response
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
