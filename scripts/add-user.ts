#!/usr/bin/env bun
import { db } from '@/db/database'
import { user, account } from '@/db/schema/auth'

async function main() {
  const [, , email, password, name] = process.argv

  if (!email || !password) {
    console.error('Usage: bun add-user.ts <email> <password> [name]')
    process.exit(1)
  }

  const userId = crypto.randomUUID()
  const accountId = crypto.randomUUID()
  const now = new Date()
  const displayName = name ?? email.split('@')[0]

  try {
    // Create user
    await db.insert(user).values({
      id: userId,
      email: email,
      name: displayName,
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
    })

    // Create account with hashed password
    await db.insert(account).values({
      id: accountId,
      accountId: accountId,
      providerId: 'credential',
      userId: userId,
      accessToken: null,
      refreshToken: null,
      idToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      scope: null,
      password: await Bun.password.hash(password),
      createdAt: now,
      updatedAt: now,
    })

    console.log('User created successfully:', email)
  } catch (error) {
    console.error('Error creating user:', error)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
