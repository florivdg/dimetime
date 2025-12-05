import { db } from '@/db/database'
import { userSetting } from '@/db/schema/settings'
import { and, eq } from 'drizzle-orm'

// Type-safe settings definitions
export interface UserSettings {
  groupTransactionsByType: boolean
}

// Default values for all settings
export const DEFAULT_SETTINGS: UserSettings = {
  groupTransactionsByType: false,
}

// Type for a single setting key
export type SettingKey = keyof UserSettings

/**
 * Get a single setting value for a user
 */
export async function getSetting<K extends SettingKey>(
  userId: string,
  key: K,
): Promise<UserSettings[K]> {
  const result = await db.query.userSetting.findFirst({
    where: and(eq(userSetting.userId, userId), eq(userSetting.key, key)),
  })

  if (!result) {
    return DEFAULT_SETTINGS[key]
  }

  return JSON.parse(result.value) as UserSettings[K]
}

/**
 * Get all settings for a user (with defaults merged)
 */
export async function getAllSettings(userId: string): Promise<UserSettings> {
  const results = await db.query.userSetting.findMany({
    where: eq(userSetting.userId, userId),
  })

  const settings = { ...DEFAULT_SETTINGS }

  for (const row of results) {
    if (row.key in DEFAULT_SETTINGS) {
      settings[row.key as SettingKey] = JSON.parse(row.value)
    }
  }

  return settings
}

/**
 * Set a single setting value for a user (upsert)
 */
export async function setSetting<K extends SettingKey>(
  userId: string,
  key: K,
  value: UserSettings[K],
): Promise<void> {
  const now = new Date()
  const serializedValue = JSON.stringify(value)

  const existing = await db.query.userSetting.findFirst({
    where: and(eq(userSetting.userId, userId), eq(userSetting.key, key)),
  })

  if (existing) {
    await db
      .update(userSetting)
      .set({ value: serializedValue, updatedAt: now })
      .where(eq(userSetting.id, existing.id))
  } else {
    await db.insert(userSetting).values({
      userId,
      key,
      value: serializedValue,
      createdAt: now,
      updatedAt: now,
    })
  }
}

/**
 * Update multiple settings at once
 */
export async function updateSettings(
  userId: string,
  settings: Partial<UserSettings>,
): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    if (key in DEFAULT_SETTINGS && value !== undefined) {
      await setSetting(userId, key as SettingKey, value)
    }
  }
}
