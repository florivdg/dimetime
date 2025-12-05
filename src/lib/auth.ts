import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import { passkey } from '@better-auth/passkey'
import { db } from '@/db/database'
import * as schema from '@/db/schema/auth'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema,
  }),
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? 'http://localhost:4321'],
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
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/*': {
        window: 60,
        max: 5,
      },
      '/passkey/*': {
        window: 60,
        max: 10,
      },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
  plugins: [
    admin(),
    passkey({
      rpID: process.env.PASSKEY_RP_ID ?? 'localhost',
      rpName: 'DimeTime',
      origin: process.env.PASSKEY_ORIGIN ?? 'http://localhost:4321',
    }),
  ],
})
