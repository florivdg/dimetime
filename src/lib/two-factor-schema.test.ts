import { describe, expect, test } from 'bun:test'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { twoFactor } from 'better-auth/plugins'
import { createHmac } from 'node:crypto'
import { symmetricDecrypt } from 'better-auth/crypto'
import { setupTestDb } from './__fixtures__/test-setup'
import * as schema from '@/db/schema/auth'

/**
 * Guards the `two_factor` Drizzle schema against better-auth's two-factor
 * plugin.
 *
 * The plugin enables account lockout by default, so a sign-in verification
 * reads and writes `failedVerificationCount` / `lockedUntil` *before* the TOTP
 * secret is decrypted. When those columns are missing the Drizzle adapter
 * throws `BetterAuthError: The field "..." does not exist in the schema`, and
 * both 2FA enrollment and 2FA login fail with a 500 — nobody can log in.
 *
 * The lockout helpers only run on the sign-in path (`isSignIn = !session`), so
 * the tests below deliberately verify with *only* the two-factor cookie rather
 * than an active session — with a session they would silently skip the very
 * code path being guarded.
 */

const db = setupTestDb()

const EMAIL = 'two-factor-schema@dimetime.test'
const PASSWORD = 'TwoFactorSchemaTest123!'
const SECRET = 'test-two-factor-schema-secret-value'

type Auth = ReturnType<typeof createAuth>

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite', schema }),
    secret: SECRET,
    baseURL: 'http://localhost:4321',
    emailAndPassword: { enabled: true, minPasswordLength: 16 },
    plugins: [twoFactor({ issuer: 'DimeTime' })],
  })
}

/**
 * Collapse every `set-cookie` on a response into one `Cookie` request header.
 * `Headers.get('set-cookie')` only yields the first, which silently drops the
 * two-factor challenge cookie.
 */
function cookiesFrom(headers: Headers): Headers {
  const cookie = headers
    .getSetCookie()
    .map((entry) => entry.split(';')[0])
    .join('; ')
  return new Headers({ cookie })
}

/**
 * Current valid TOTP code for the single seeded two-factor row (RFC 6238,
 * SHA-1, 6 digits, 30s — better-auth's defaults). Computed locally so the test
 * needs no extra dependency.
 *
 * The stored secret is HMAC'd as raw UTF-8, not base32-decoded: the base32
 * string users scan is an encoding of these bytes, not the key itself.
 */
async function currentCode(): Promise<string> {
  const row = db.$client
    .query('select secret from two_factor limit 1')
    .get() as { secret: string }
  const raw = await symmetricDecrypt({ key: SECRET, data: row.secret })

  const counter = Buffer.alloc(8)
  counter.writeBigInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)))
  const digest = createHmac('sha1', Buffer.from(raw, 'utf8'))
    .update(counter)
    .digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  return String(binary % 1_000_000).padStart(6, '0')
}

function failureCount(): number | null {
  const row = db.$client
    .query('select failed_verification_count from two_factor limit 1')
    .get() as { failed_verification_count: number | null }
  return row.failed_verification_count
}

/**
 * Register a user with 2FA fully enabled, then sign in again with only the
 * password so the returned cookie is the two-factor challenge cookie — the
 * state a real user is in when they type their TOTP code at login.
 */
async function signInAwaitingSecondFactor(auth: Auth): Promise<Headers> {
  const signUp = await auth.api.signUpEmail({
    body: { email: EMAIL, password: PASSWORD, name: 'Two Factor Schema' },
    returnHeaders: true,
  })
  const sessionHeaders = cookiesFrom(signUp.headers)

  await auth.api.enableTwoFactor({
    body: { password: PASSWORD },
    headers: sessionHeaders,
  })
  // Enrollment is only committed once a first code is accepted.
  await auth.api.verifyTOTP({
    body: { code: await currentCode() },
    headers: sessionHeaders,
  })

  const signIn = await auth.api.signInEmail({
    body: { email: EMAIL, password: PASSWORD },
    returnHeaders: true,
  })
  return cookiesFrom(signIn.headers)
}

describe('two_factor schema vs better-auth two-factor plugin', () => {
  test('enrolling in 2FA does not hit a missing schema field', async () => {
    const auth = createAuth()
    const signUp = await auth.api.signUpEmail({
      body: { email: EMAIL, password: PASSWORD, name: 'Two Factor Schema' },
      returnHeaders: true,
    })
    const headers = cookiesFrom(signUp.headers)

    const enabled = await auth.api.enableTwoFactor({
      body: { password: PASSWORD },
      headers,
    })

    // Since better-auth 1.7 the payload is a discriminated union
    // (`{ method: 'otp' } | { method: 'totp', totpURI, backupCodes }`); assert
    // the discriminant so a future shape change fails here loudly.
    expect(enabled.method).toBe('totp')
    if (enabled.method !== 'totp') throw new Error('expected a TOTP enrollment')
    expect(enabled.totpURI).toContain('otpauth://totp/')
  })

  test('a correct code at sign-in clears the lockout counter', async () => {
    const auth = createAuth()
    const challengeHeaders = await signInAwaitingSecondFactor(auth)

    // assertTwoFactorNotLocked runs before the secret is decrypted, and
    // resetTwoFactorFailures runs right after the code is accepted. Both touch
    // the lockout columns.
    const verified = await auth.api.verifyTOTP({
      body: { code: await currentCode() },
      headers: challengeHeaders,
    })

    expect(verified.token).toBeTruthy()
    expect(failureCount()).toBe(0)
  })

  test('a wrong code at sign-in increments the counter instead of crashing', async () => {
    const auth = createAuth()
    const challengeHeaders = await signInAwaitingSecondFactor(auth)

    let caught: unknown
    try {
      await auth.api.verifyTOTP({
        body: { code: '000000' },
        headers: challengeHeaders,
      })
    } catch (error) {
      caught = error
    }

    // A clean rejection, not the Drizzle schema crash that would surface as a
    // 500 to the user.
    expect(caught).toBeDefined()
    expect(String(caught)).not.toContain('does not exist in the')
    // recordTwoFactorFailure ran, which is only possible with the column.
    expect(failureCount()).toBe(1)
  })
})
