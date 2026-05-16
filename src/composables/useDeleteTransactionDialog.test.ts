import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { useDeleteTransactionDialog } from './useDeleteTransactionDialog'

const sampleTx = {
  id: 'tx-1',
  name: 'Test',
  amount: 1000,
} as never

let originalFetch: typeof globalThis.fetch
let fetchCalls: Array<{ url: string; init?: RequestInit }>
let fetchResponse: Response

beforeEach(() => {
  originalFetch = globalThis.fetch
  fetchCalls = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(input), init })
    return fetchResponse
  }) as unknown as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('useDeleteTransactionDialog', () => {
  it('openDeleteDialog sets the dialog state', () => {
    const { deleteDialogOpen, transactionToDelete, openDeleteDialog } =
      useDeleteTransactionDialog(
        () => undefined,
        () => undefined,
      )
    openDeleteDialog(sampleTx)
    expect(deleteDialogOpen.value).toBe(true)
    expect(transactionToDelete.value?.id).toBe('tx-1')
  })

  it('deleteTransaction calls DELETE and emits deleted on success', async () => {
    fetchResponse = new Response('{}', { status: 200 })
    let deletedEmitted = false
    const { deleteTransaction } = useDeleteTransactionDialog(
      () => {
        deletedEmitted = true
      },
      () => undefined,
    )
    await deleteTransaction('tx-1')
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0].url).toBe('/api/transactions/tx-1')
    expect(fetchCalls[0].init?.method).toBe('DELETE')
    expect(deletedEmitted).toBe(true)
  })

  it('emits error with API message on non-ok response', async () => {
    fetchResponse = new Response(JSON.stringify({ error: 'Server says no' }), {
      status: 400,
    })
    const errors: string[] = []
    const { deleteTransaction } = useDeleteTransactionDialog(
      () => undefined,
      (msg) => errors.push(msg),
    )
    await deleteTransaction('tx-1')
    expect(errors).toEqual(['Server says no'])
  })

  it('emits fallback error when error body has no message', async () => {
    fetchResponse = new Response('{}', { status: 500 })
    const errors: string[] = []
    const { deleteTransaction } = useDeleteTransactionDialog(
      () => undefined,
      (msg) => errors.push(msg),
    )
    await deleteTransaction('tx-1')
    expect(errors).toEqual(['Fehler beim Löschen'])
  })

  it('emits network fallback on fetch reject', async () => {
    globalThis.fetch = (async () => {
      throw new Error('network down')
    }) as unknown as typeof globalThis.fetch
    const errors: string[] = []
    const { deleteTransaction } = useDeleteTransactionDialog(
      () => undefined,
      (msg) => errors.push(msg),
    )
    await deleteTransaction('tx-1')
    expect(errors).toEqual(['network down'])
  })
})
