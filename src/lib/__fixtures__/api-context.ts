interface ContextOverrides {
  method?: string
  url?: string
  body?: unknown
  bodyText?: string
  params?: Record<string, string | undefined>
  userId?: string | null
  contentType?: string
}

export function buildApiContext(overrides: ContextOverrides = {}) {
  const {
    method = 'GET',
    url = 'http://test.local/api/test',
    body,
    bodyText,
    params = {},
    userId = null,
    contentType = 'application/json',
  } = overrides

  const finalBody =
    bodyText !== undefined
      ? bodyText
      : body !== undefined
        ? JSON.stringify(body)
        : undefined

  const headers: Record<string, string> = {}
  if (finalBody !== undefined) headers['Content-Type'] = contentType

  const request = new Request(url, {
    method,
    headers,
    body: finalBody,
  })

  const parsedUrl = new URL(url)

  return {
    request,
    params,
    url: parsedUrl,
    locals: { user: userId ? { id: userId } : undefined } as never,
    redirect: () => new Response(null, { status: 302 }),
    site: undefined,
    cookies: {} as never,
    clientAddress: '127.0.0.1',
  }
}
