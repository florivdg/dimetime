import type { ZodType } from 'zod'

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export const error = (message: string, status: number): Response =>
  json({ error: message }, status)

const badJson = (): Response => error('Ungültiges JSON', 400)

export const unauthorized = (): Response => error('Nicht authentifiziert', 401)

export async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return badJson()
  }
}

export function validate<T>(schema: ZodType<T>, body: unknown): T | Response {
  const parsed = schema.safeParse(body)
  if (!parsed.success) return error(parsed.error.issues[0].message, 400)
  return parsed.data
}
