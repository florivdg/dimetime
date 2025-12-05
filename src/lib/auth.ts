import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { passkey } from '@better-auth/passkey'
import { db } from '@/db/database'
import * as schema from '@/db/schema/auth'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 16,
    password: {
      async hash(password) {
        return await Bun.password.hash(password)
      },
      async verify(data) {
        return await Bun.password.verify(data.password, data.hash)
      },
    },
  },
  plugins: [
    passkey({
      rpID: process.env.PASSKEY_RP_ID ?? 'localhost',
      rpName: 'DimeTime',
      origin: process.env.PASSKEY_ORIGIN ?? 'http://localhost:4321',
    }),
  ],
})
