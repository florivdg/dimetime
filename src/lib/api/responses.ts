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

export function requireUserId(locals: App.Locals): string | Response {
  return locals.user?.id ?? unauthorized()
}

export async function handle<T>(
  fn: () => Promise<T>,
  fallbackMsg: string,
  logTag = fallbackMsg,
): Promise<T | Response> {
  try {
    return await fn()
  } catch (err) {
    console.error(`${logTag}:`, err)
    return error(err instanceof Error ? err.message : fallbackMsg, 500)
  }
}

export async function requireExisting<T>(
  params: Record<string, string | undefined>,
  paramKey: string,
  paramLabel: string,
  loader: (id: string) => Promise<T | undefined | null>,
  notFoundMsg: string,
): Promise<{ id: string; resource: T } | Response> {
  const id = params[paramKey]
  if (!id) return error(`${paramLabel} fehlt`, 400)
  const resource = await loader(id)
  if (!resource) return error(notFoundMsg, 404)
  return { id, resource }
}

// fallow-ignore-next-line complexity
export async function requireOwned<T>(
  params: Record<string, string | undefined>,
  paramKey: string,
  paramLabel: string,
  locals: App.Locals,
  loader: (id: string) => Promise<T | undefined | null>,
  notFoundMsg: string,
): Promise<{ id: string; userId: string; resource: T } | Response> {
  const userId = locals.user?.id
  if (!userId) return unauthorized()
  const id = params[paramKey]
  if (!id) return error(`${paramLabel} fehlt`, 400)
  const resource = await loader(id)
  if (!resource) return error(notFoundMsg, 404)
  if ((resource as { userId?: unknown }).userId !== userId) {
    return error('Nicht autorisiert', 403)
  }
  return { id, userId, resource }
}
