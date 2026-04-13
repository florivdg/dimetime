import { createSign } from 'node:crypto'
import { requireEnableBankingConfig } from './config'

export function generateJwt(): string {
  const { appId, privateKey, audience } = requireEnableBankingConfig()

  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + 3600

  const header = Buffer.from(
    JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: appId }),
  ).toString('base64url')

  const payload = Buffer.from(
    JSON.stringify({
      iss: 'enablebanking.com',
      aud: audience,
      iat,
      exp,
    }),
  ).toString('base64url')

  const sign = createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const signature = sign.sign(privateKey, 'base64url')

  return `${header}.${payload}.${signature}`
}

export function enableBankingAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${generateJwt()}`,
  }
}
