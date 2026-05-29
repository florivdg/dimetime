import { expect } from 'bun:test'
import { buildApiContext } from './api-context'

type RouteHandler = (context: never) => Promise<Response> | Response

/**
 * POST `body` to a bulk-route handler, assert a 200 response, and assert the
 * returned `count`. Shared by the bank-transaction bulk-assign suites whose
 * success-path tests are otherwise identical apart from the request body.
 */
export async function postExpectCount(
  handler: RouteHandler,
  body: unknown,
  count: number,
): Promise<void> {
  const res = (await handler(
    buildApiContext({ method: 'POST', body }) as never,
  )) as Response
  expect(res.status).toBe(200)
  const json = await res.json()
  expect(json.count).toBe(count)
}

/**
 * GET a route handler as `userId`, assert a 200 response, and return the parsed
 * JSON body. Shared by the `presets` / `transactions` index suites whose
 * paginated-list assertions read distinct fields off the same response shape.
 */
export async function getExpectOkBody(
  handler: RouteHandler,
  userId: string,
  // Mirrors the untyped `await res.json()` the call sites used previously.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const res = (await handler(buildApiContext({ userId }) as never)) as Response
  expect(res.status).toBe(200)
  return await res.json()
}

interface PostOpts {
  body?: unknown
  userId?: string
  params?: Record<string, string | undefined>
}

/**
 * POST `body` to a route handler (optionally with `userId` / `params`) and
 * assert the resulting HTTP status. Shared by the preset route suites whose
 * request-and-assert blocks differ only in the body and expected status.
 */
export async function postExpectStatus(
  handler: RouteHandler,
  opts: PostOpts,
  status: number,
): Promise<void> {
  const res = (await handler(
    buildApiContext({ method: 'POST', ...opts }) as never,
  )) as Response
  expect(res.status).toBe(status)
}

/**
 * POST to a route handler, assert a 201 response, and return the parsed JSON
 * body. Shared by the preset success-path tests that create a resource and then
 * assert distinct fields on the response.
 */
export async function postExpectCreated(
  handler: RouteHandler,
  opts: PostOpts,
  // Mirrors the untyped `await res.json()` the call sites used previously.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const res = (await handler(
    buildApiContext({ method: 'POST', ...opts }) as never,
  )) as Response
  expect(res.status).toBe(201)
  return await res.json()
}
