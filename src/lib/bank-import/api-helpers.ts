export function statusCodeForMessage(message: string): number {
  if (message.includes('nicht gefunden')) return 404
  if (
    message.includes('Ungültig') ||
    message.includes('erwartet') ||
    message.includes('deaktiviert') ||
    message.includes('nicht unterstützt') ||
    message.includes('fehlt')
  ) {
    return 400
  }
  return 500
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
