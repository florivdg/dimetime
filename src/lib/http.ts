type MutateMethod = 'PUT' | 'POST' | 'PATCH' | 'DELETE'

interface MutateOptions {
  url: string
  method?: MutateMethod
  /** JSON body; omit for requests without a payload (e.g. DELETE). */
  body?: unknown
  /** Error thrown when the response is not ok and carries no `error` field. */
  notOkMessage: string
  /** Message surfaced when a non-Error value is thrown. */
  fallbackMessage: string
  onSuccess: () => void
  onError: (message: string) => void
}

/**
 * Perform a mutating JSON request and route the outcome through callbacks.
 * On a non-ok response it throws `data.error || notOkMessage`; any thrown value
 * is reported via `onError` (its message when it is an `Error`, otherwise
 * `fallbackMessage`). Shared by the inline-edit tables and the edit dialogs.
 */
export async function mutateJson(opts: MutateOptions): Promise<void> {
  const { url, method = 'PUT', body, notOkMessage, fallbackMessage } = opts
  try {
    const init: RequestInit = { method }
    if (body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' }
      init.body = JSON.stringify(body)
    }
    const response = await fetch(url, init)
    if (!response.ok) {
      const data = (await response.json()) as { error?: string }
      throw new Error(data.error || notOkMessage)
    }
    opts.onSuccess()
  } catch (error) {
    opts.onError(error instanceof Error ? error.message : fallbackMessage)
  }
}
