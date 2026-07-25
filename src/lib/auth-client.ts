import { createAuthClient } from 'better-auth/vue'
import { passkeyClient } from '@better-auth/passkey/client'
import { apiKeyClient } from '@better-auth/api-key/client'
import { twoFactorClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  plugins: [
    passkeyClient(),
    apiKeyClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        // Preserve redirectTo parameter from current URL
        const params = new URLSearchParams(window.location.search)
        const redirectTo = params.get('redirectTo')
        const verifyUrl = redirectTo
          ? `/2fa/verify?redirectTo=${encodeURIComponent(redirectTo)}`
          : '/2fa/verify'
        window.location.href = verifyUrl
      },
    }),
  ],
})
