import { expect, it } from 'bun:test'
import { buildApiContext } from './api-context'

type RouteHandler = (context: never) => Promise<Response> | Response

/**
 * Registers the two standard guard tests shared by every `/[id]` route handler:
 * a 400 when the `id` param is absent, and a 404 when it points at a row that
 * does not exist. Call it inside the route's `describe(...)` block.
 */
export function itGuardsIdRoute(
  handler: RouteHandler,
  opts: {
    method: string
    unknownId: string
    body?: unknown
    notFoundName?: string
  },
): void {
  const {
    method,
    unknownId,
    body,
    notFoundName = 'returns 404 when not found',
  } = opts

  it('returns 400 when id missing', async () => {
    const res = (await handler(
      buildApiContext({ method, body }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it(notFoundName, async () => {
    const res = (await handler(
      buildApiContext({ method, body, params: { id: unknownId } }) as never,
    )) as Response
    expect(res.status).toBe(404)
  })
}

/**
 * Registers the shared "rejects invalid JSON" test: POST a malformed body and
 * expect a 400. Call it inside a route's POST `describe(...)` block.
 */
export function itRejectsInvalidJson(handler: RouteHandler): void {
  it('rejects invalid JSON', async () => {
    const res = (await handler(
      buildApiContext({ method: 'POST', bodyText: '{bad' }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })
}

/**
 * Registers the two PUT-success tests shared by `/[id]` update routes: a 400
 * for an invalid body and a 200 that renames the resource. `seed` provisions
 * the row, `id` is the existing row id, and `resourceName` fills the German
 * "updates and returns the …" description.
 */
export function itUpdatesViaPut(
  handler: RouteHandler,
  opts: {
    seed: () => Promise<void>
    id: string
    invalidBody: unknown
    resourceName: string
    userId?: string
  },
): void {
  const { seed, id, invalidBody, resourceName, userId } = opts

  it('rejects invalid body', async () => {
    await seed()
    const res = (await handler(
      buildApiContext({
        method: 'PUT',
        body: invalidBody,
        params: { id },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(400)
  })

  it(`updates and returns the ${resourceName}`, async () => {
    await seed()
    const res = (await handler(
      buildApiContext({
        method: 'PUT',
        body: { name: 'Renamed' },
        params: { id },
        userId,
      }) as never,
    )) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Renamed')
  })
}
