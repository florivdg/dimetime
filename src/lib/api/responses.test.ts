import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import {
  error,
  handle,
  json,
  parseJson,
  requireExisting,
  requireOwned,
  requireUserId,
  unwrap,
  validate,
  validateBody,
} from './responses'

function jsonRequest(
  body: unknown,
  opts: { malformed?: boolean } = {},
): Request {
  const text = opts.malformed ? '{not json}' : JSON.stringify(body)
  return new Request('http://test/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: text,
  })
}

describe('json + error', () => {
  it('json returns a Response with status 200 by default', async () => {
    const res = json({ ok: true })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/json')
    expect(await res.json()).toEqual({ ok: true })
  })

  it('json honors custom status', () => {
    expect(json({}, 201).status).toBe(201)
  })

  it('error wraps message into JSON', async () => {
    const res = error('Boom', 418)
    expect(res.status).toBe(418)
    expect(await res.json()).toEqual({ error: 'Boom' })
  })
})

describe('parseJson', () => {
  it('returns parsed body on valid JSON', async () => {
    const body = await parseJson(jsonRequest({ a: 1 }))
    expect(body).toEqual({ a: 1 })
  })

  it('returns a 400 Response on malformed JSON', async () => {
    const result = await parseJson(jsonRequest(null, { malformed: true }))
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(400)
  })
})

describe('validate', () => {
  const schema = z.object({ name: z.string().min(1) })

  it('returns parsed data on success', () => {
    expect(validate(schema, { name: 'foo' })).toEqual({ name: 'foo' })
  })

  it('returns 400 Response with first issue message on failure', async () => {
    const result = validate(schema, { name: '' })
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(400)
  })
})

describe('validateBody', () => {
  const schema = z.object({ name: z.string().min(1) })

  it('returns data when valid', async () => {
    const result = await validateBody(jsonRequest({ name: 'ok' }), schema)
    expect(result).toEqual({ name: 'ok' })
  })

  it('returns 400 Response on malformed JSON', async () => {
    const result = await validateBody(
      jsonRequest(null, { malformed: true }),
      schema,
    )
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(400)
  })

  it('returns 400 Response on validation failure', async () => {
    const result = await validateBody(jsonRequest({ name: '' }), schema)
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(400)
  })
})

describe('requireUserId', () => {
  it('returns user id when locals.user is present', () => {
    const result = requireUserId({ user: { id: 'u-1' } } as never)
    expect(result).toBe('u-1')
  })

  it('returns 401 Response when user is missing', async () => {
    const result = requireUserId({} as never)
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })
})

describe('handle', () => {
  it('returns the function result on success', async () => {
    const result = await handle(async () => 'ok', 'fallback')
    expect(result).toBe('ok')
  })

  it('returns the thrown Response unchanged', async () => {
    const thrown = error('explicit', 422)
    const result = await handle(async () => {
      throw thrown
    }, 'fallback')
    expect(result).toBe(thrown)
  })

  it('wraps an Error into a 500 Response with its message', async () => {
    const result = await handle(async () => {
      throw new Error('boom')
    }, 'fallback')
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(500)
    expect(await (result as Response).json()).toEqual({ error: 'boom' })
  })

  it('falls back to fallbackMsg when thrown value is non-Error', async () => {
    const result = await handle(async () => {
      throw 'string-error'
    }, 'fallback msg')
    expect(result).toBeInstanceOf(Response)
    expect(await (result as Response).json()).toEqual({ error: 'fallback msg' })
  })
})

describe('unwrap', () => {
  it('returns the value unchanged when it is not a Response', () => {
    expect(unwrap({ a: 1 })).toEqual({ a: 1 })
  })

  it('throws the Response when given one', () => {
    const res = error('oops', 400)
    expect(() => unwrap(res)).toThrow()
  })
})

describe('requireExisting', () => {
  it('returns 400 when param key is missing', async () => {
    const result = await requireExisting(
      {},
      'id',
      'ID',
      async () => ({ id: 'x' }),
      'not found',
    )
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(400)
  })

  it('returns 404 when loader returns null', async () => {
    const result = await requireExisting(
      { id: 'x' },
      'id',
      'ID',
      async () => null,
      'not found',
    )
    expect((result as Response).status).toBe(404)
  })

  it('returns id + resource on success', async () => {
    const result = await requireExisting(
      { id: 'x' },
      'id',
      'ID',
      async () => ({ id: 'x', name: 'A' }),
      'not found',
    )
    expect(result).toEqual({ id: 'x', resource: { id: 'x', name: 'A' } })
  })
})

describe('requireOwned', () => {
  const locals = { user: { id: 'owner' } } as never

  it('returns 401 when no user', async () => {
    const result = await requireOwned(
      { id: 'x' },
      'id',
      'ID',
      {} as never,
      async () => ({ id: 'x', userId: 'owner' }),
      'not found',
    )
    expect((result as Response).status).toBe(401)
  })

  it('returns 400 when id missing', async () => {
    const result = await requireOwned(
      {},
      'id',
      'ID',
      locals,
      async () => ({ id: 'x', userId: 'owner' }),
      'not found',
    )
    expect((result as Response).status).toBe(400)
  })

  it('returns 404 when loader returns null', async () => {
    const result = await requireOwned(
      { id: 'x' },
      'id',
      'ID',
      locals,
      async () => null,
      'not found',
    )
    expect((result as Response).status).toBe(404)
  })

  it('returns 403 when resource belongs to another user', async () => {
    const result = await requireOwned(
      { id: 'x' },
      'id',
      'ID',
      locals,
      async () => ({ id: 'x', userId: 'someone-else' }),
      'not found',
    )
    expect((result as Response).status).toBe(403)
  })

  it('returns full owned object on success', async () => {
    const resource = { id: 'x', userId: 'owner', name: 'A' }
    const result = await requireOwned(
      { id: 'x' },
      'id',
      'ID',
      locals,
      async () => resource,
      'not found',
    )
    expect(result).toEqual({ id: 'x', userId: 'owner', resource })
  })
})
