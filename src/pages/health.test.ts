import { describe, expect, it, spyOn } from 'bun:test'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'

const testDb = setupTestDb()
const { GET } = await import('./health')

describe('GET /health', () => {
  it('checks the database and returns an uncached healthy response', async () => {
    const run = spyOn(testDb, 'run')
    try {
      const response = (await GET({} as never)) as Response
      expect(run).toHaveBeenCalledTimes(1)
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/json')
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(await response.json()).toEqual({
        status: 'ok',
        checks: { database: { status: 'ok' } },
      })
    } finally {
      run.mockRestore()
    }
  })

  it('returns 503 without exposing database details outside development', async () => {
    const run = spyOn(testDb, 'run').mockImplementation(() => {
      throw new Error('Private database path and credentials')
    })
    try {
      const response = (await GET({} as never)) as Response
      expect(response.status).toBe(503)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(await response.json()).toEqual({
        status: 'unhealthy',
        checks: { database: { status: 'error' } },
      })
    } finally {
      run.mockRestore()
    }
  })
})
