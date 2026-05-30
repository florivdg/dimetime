import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import {
  ImportApiError,
  jsonError,
  jsonResponse,
  notFoundError,
  parseJsonBody,
  runImportFlow,
  validationError,
} from './api-helpers'

function formDataRequest(form: Record<string, string | File>): Request {
  const fd = new FormData()
  for (const [k, v] of Object.entries(form)) fd.append(k, v)
  return new Request('http://test/api/bank-imports/preview', {
    method: 'POST',
    body: fd,
  })
}

function jsonRequest(body: unknown, malformed = false): Request {
  return new Request('http://test/api/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: malformed ? '{nope' : JSON.stringify(body),
  })
}

describe('error factories', () => {
  it('validationError yields 400 ImportApiError', () => {
    const err = validationError('bad')
    expect(err).toBeInstanceOf(ImportApiError)
    expect(err.status).toBe(400)
    expect(err.message).toBe('bad')
  })

  it('notFoundError yields 404 ImportApiError', () => {
    const err = notFoundError('missing')
    expect(err.status).toBe(404)
    expect(err.message).toBe('missing')
  })
})

describe('jsonResponse / jsonError', () => {
  it('jsonResponse returns a JSON response', async () => {
    const res = jsonResponse({ ok: true }, 201)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('jsonError defaults to 400 and wraps error key', async () => {
    const res = jsonError('Ungültig')
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Ungültig' })
  })
})

describe('runImportFlow', () => {
  it('rejects non-multipart bodies with 400', async () => {
    const req = new Request('http://test/api/x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const res = await runImportFlow(req, null, async () => ({ ok: true }))
    expect(res.status).toBe(400)
  })

  it('rejects when sourceId is missing', async () => {
    const res = await runImportFlow(
      formDataRequest({ file: new File(['x'], 'a.csv') }),
      null,
      async () => ({ ok: true }),
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'sourceId ist erforderlich.' })
  })

  it('rejects when file is missing or empty', async () => {
    const res = await runImportFlow(
      formDataRequest({
        sourceId: 'src-1',
        file: new File([], 'empty.csv'),
      }),
      null,
      async () => ({ ok: true }),
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Datei fehlt oder ist leer.' })
  })

  it('returns runner result wrapped in jsonResponse on success', async () => {
    const res = await runImportFlow(
      formDataRequest({
        sourceId: 'src-1',
        file: new File(['hello'], 'a.csv'),
      }),
      'user-1',
      async (input) => ({
        sourceId: input.sourceId,
        user: input.triggeredByUserId,
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sourceId: 'src-1', user: 'user-1' })
  })

  it('maps ImportApiError to its status and message', async () => {
    const res = await runImportFlow(
      formDataRequest({
        sourceId: 'src-1',
        file: new File(['hi'], 'a.csv'),
      }),
      null,
      async () => {
        throw notFoundError('Nicht gefunden')
      },
    )
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Nicht gefunden' })
  })

  it('maps generic Error to 500 with its message', async () => {
    const res = await runImportFlow(
      formDataRequest({
        sourceId: 'src-1',
        file: new File(['hi'], 'a.csv'),
      }),
      null,
      async () => {
        throw new Error('boom')
      },
    )
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'boom' })
  })
})

describe('parseJsonBody', () => {
  const schema = z.object({ name: z.string().min(1) })

  it('returns data on valid body', async () => {
    const result = await parseJsonBody(jsonRequest({ name: 'ok' }), schema)
    expect('data' in result && result.data).toEqual({ name: 'ok' })
  })

  it('returns error Response for invalid JSON with custom message', async () => {
    const result = await parseJsonBody(
      jsonRequest(null, true),
      schema,
      'custom-bad-json',
    )
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBeInstanceOf(Response)
      expect(await result.error.json()).toEqual({ error: 'custom-bad-json' })
    }
  })

  it('returns error Response for schema validation failure', async () => {
    const result = await parseJsonBody(jsonRequest({ name: '' }), schema)
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.status).toBe(400)
    }
  })
})
