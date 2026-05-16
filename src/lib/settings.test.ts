import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import * as authSchema from '@/db/schema/auth'
import { createTestDb } from '@/lib/__fixtures__/test-db'

const harness = createTestDb()
const testDb = harness.db

void mock.module('@/db/database', () => ({
  db: testDb,
}))

const { getAllSettings, getSetting, updateSettings } =
  await import('./settings')

const userId = 'user-1'

async function seedUser() {
  const now = new Date()
  await testDb.insert(authSchema.user).values({
    id: userId,
    name: 'Tester',
    email: 'tester@example.com',
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

describe('getSetting', () => {
  it('returns the default value when nothing is stored', async () => {
    expect(await getSetting(userId, 'groupTransactionsByType')).toBe(false)
    expect(await getSetting(userId, 'themePreference')).toBe('system')
  })

  it('returns the stored JSON value when present', async () => {
    await updateSettings(userId, {
      groupTransactionsByType: true,
      themePreference: 'dark',
    })
    expect(await getSetting(userId, 'groupTransactionsByType')).toBe(true)
    expect(await getSetting(userId, 'themePreference')).toBe('dark')
  })
})

describe('getAllSettings', () => {
  it('returns full defaults when no rows exist', async () => {
    const settings = await getAllSettings(userId)
    expect(settings).toEqual({
      groupTransactionsByType: false,
      themePreference: 'system',
    })
  })

  it('merges stored values over defaults', async () => {
    await updateSettings(userId, { themePreference: 'light' })
    const settings = await getAllSettings(userId)
    expect(settings).toEqual({
      groupTransactionsByType: false,
      themePreference: 'light',
    })
  })

  it('ignores rows with unknown keys', async () => {
    // Manually insert an unknown key row
    await testDb
      .insert((await import('@/db/schema/settings')).userSetting)
      .values({
        userId,
        key: 'unknown',
        value: '"x"',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    const settings = await getAllSettings(userId)
    expect(settings).toEqual({
      groupTransactionsByType: false,
      themePreference: 'system',
    })
  })
})

describe('updateSettings', () => {
  it('inserts a row when none exists for the key', async () => {
    await updateSettings(userId, { themePreference: 'dark' })
    expect(await getSetting(userId, 'themePreference')).toBe('dark')
  })

  it('updates an existing row instead of inserting a duplicate', async () => {
    await updateSettings(userId, { themePreference: 'dark' })
    await updateSettings(userId, { themePreference: 'light' })
    expect(await getSetting(userId, 'themePreference')).toBe('light')

    const all = await testDb.query.userSetting.findMany({
      where: (us, { and: a, eq: e }) =>
        a(e(us.userId, userId), e(us.key, 'themePreference')),
    })
    expect(all.length).toBe(1)
  })

  it('ignores keys not declared in DEFAULT_SETTINGS', async () => {
    await updateSettings(userId, {
      themePreference: 'light',
      // @ts-expect-error - intentionally testing unknown key handling
      mystery: true,
    })
    expect(await getSetting(userId, 'themePreference')).toBe('light')
  })

  it('ignores undefined values', async () => {
    await updateSettings(userId, {
      themePreference: undefined,
      groupTransactionsByType: true,
    })
    expect(await getSetting(userId, 'themePreference')).toBe('system')
    expect(await getSetting(userId, 'groupTransactionsByType')).toBe(true)
  })
})
