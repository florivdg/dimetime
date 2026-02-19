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

export function asImportApiError(error: unknown): {
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

export async function parseImportFormData(
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
