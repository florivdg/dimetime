import { afterEach, describe, expect, it, mock } from 'bun:test'
import { useKassensturz } from './useKassensturz'

const originalFetch = globalThis.fetch

function createKassensturzPayload() {
  return {
    summary: {
      plannedIncome: 0,
      plannedExpense: 0,
      plannedNet: 0,
      actualIncome: 0,
      actualExpense: 0,
      actualNet: 0,
    },
    plannedItems: [],
    unmatchedBankTransactions: [],
    dismissals: [],
    manualEntries: [],
  }
}

function toUrl(input: string | URL | Request) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('useKassensturz.reconcileMany', () => {
  it('reloads data after partial failure and rethrows first error', async () => {
    let reconcileCall = 0

    const fetchMock = mock(async (input: string | URL | Request) => {
      const url = toUrl(input)

      if (url.endsWith('/kassensturz/reconcile')) {
        reconcileCall += 1
        if (reconcileCall === 2) {
          return new Response(
            JSON.stringify({
              error: 'Diese Banktransaktion wurde bereits abgeglichen.',
            }),
            {
              status: 409,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        return new Response(JSON.stringify({ id: `rec-${reconcileCall}` }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.endsWith('/kassensturz')) {
        return new Response(JSON.stringify(createKassensturzPayload()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(
        JSON.stringify({ error: 'Unbekannter Test-Endpunkt' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    })

    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { reconcileMany } = useKassensturz('plan-1')

    let thrown: unknown = null
    try {
      await reconcileMany(['bank-1', 'bank-2'], 'planned-1')
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message).toBe(
      'Diese Banktransaktion wurde bereits abgeglichen.',
    )

    expect(fetchMock.mock.calls.length).toBe(3)
    expect(
      toUrl(fetchMock.mock.calls[2]?.[0] as string | URL | Request),
    ).toContain('/api/plans/plan-1/kassensturz')
  })
})

describe('useKassensturz.runAutoReconcile', () => {
  it('stores result, toggles loading state, and reloads data', async () => {
    const autoResult = {
      stats: {
        processed: 3,
        matched: 1,
        suggested: 1,
        skippedAmbiguous: 0,
        skippedNoCandidate: 1,
      },
      applied: [],
      suggestions: [],
    }

    const fetchMock = mock(async (input: string | URL | Request) => {
      const url = toUrl(input)

      if (url.endsWith('/kassensturz/auto-reconcile')) {
        return new Response(JSON.stringify(autoResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.endsWith('/kassensturz')) {
        return new Response(JSON.stringify(createKassensturzPayload()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ error: 'Unbekannter Endpunkt' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    })

    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { autoRunInProgress, lastAutoRunResult, runAutoReconcile } =
      useKassensturz('plan-1')

    const runPromise = runAutoReconcile()
    expect(autoRunInProgress.value).toBe(true)

    const result = await runPromise
    expect(result).toEqual(autoResult)
    expect(autoRunInProgress.value).toBe(false)
    expect(lastAutoRunResult.value).toEqual(autoResult)
    expect(fetchMock.mock.calls.length).toBe(2)
  })

  it('rethrows API error and resets loading state', async () => {
    const fetchMock = mock(async (input: string | URL | Request) => {
      const url = toUrl(input)

      if (url.endsWith('/kassensturz/auto-reconcile')) {
        return new Response(
          JSON.stringify({ error: 'Auto-Zuordnung fehlgeschlagen' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      return new Response(JSON.stringify(createKassensturzPayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })

    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { autoRunInProgress, runAutoReconcile } = useKassensturz('plan-1')

    let thrown: unknown = null
    try {
      await runAutoReconcile()
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message).toBe('Auto-Zuordnung fehlgeschlagen')
    expect(autoRunInProgress.value).toBe(false)
  })
})
