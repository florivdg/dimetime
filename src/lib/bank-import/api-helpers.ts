export class ImportApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ImportApiError'
    this.status = status
  }
}

export function validationError(message: string): ImportApiError {
  return new ImportApiError(400, message)
}

export function notFoundError(message: string): ImportApiError {
  return new ImportApiError(404, message)
}

function asImportApiError(error: unknown): {
  status: number
  message: string
} {
  if (error instanceof ImportApiError) {
    return { status: error.status, message: error.message }
  }

  if (error instanceof Error) {
    return {
      status: 500,
      message: error.message || 'Unbekannter interner Fehler',
    }
  }

  return { status: 500, message: 'Unbekannter interner Fehler' }
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function jsonError(error: string, status = 400): Response {
  return jsonResponse({ error }, status)
}

async function parseImportFormData(
  request: Request,
): Promise<{ sourceId: string; file: File } | Response> {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return jsonError(
      'Ungültige Anfrage. Erwartet wird multipart/form-data.',
      400,
    )
  }

  const sourceId = formData.get('sourceId')
  const file = formData.get('file')

  if (typeof sourceId !== 'string' || sourceId.length === 0) {
    return jsonError('sourceId ist erforderlich.', 400)
  }

  if (!(file instanceof File) || file.size === 0) {
    return jsonError('Datei fehlt oder ist leer.', 400)
  }

  return { sourceId, file }
}

interface ImportRunner<T> {
  (input: {
    sourceId: string
    file: File
    triggeredByUserId?: string | null
  }): Promise<T>
}

export async function runImportFlow<T>(
  request: Request,
  triggeredByUserId: string | null,
  runner: ImportRunner<T>,
): Promise<Response> {
  const parsed = await parseImportFormData(request)
  if (parsed instanceof Response) return parsed

  try {
    const result = await runner({
      sourceId: parsed.sourceId,
      file: parsed.file,
      triggeredByUserId,
    })
    return jsonResponse(result)
  } catch (error) {
    const mapped = asImportApiError(error)
    return jsonError(mapped.message, mapped.status)
  }
}

type ZodSafeParse<T> =
  | {
      success: true
      data: T
    }
  | {
      success: false
      error: { issues: Array<{ message?: string }> }
    }

export async function parseJsonBody<T>(
  request: Request,
  schema: { safeParse: (body: unknown) => ZodSafeParse<T> },
  invalidJsonMessage = 'Ungültiges JSON',
): Promise<{ data: T } | { error: Response }> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return { error: jsonError(invalidJsonMessage) }
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return {
      error: jsonError(parsed.error.issues[0]?.message ?? 'Ungültige Eingabe'),
    }
  }
  return { data: parsed.data }
}
