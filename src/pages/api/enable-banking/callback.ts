import type { APIRoute } from 'astro'
import {
  EB_STATE_COOKIE,
  isEnableBankingConfigured,
} from '@/lib/enable-banking/config'
import { completeConnect } from '@/lib/enable-banking/service'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderPage(title: string, message: string, ok: boolean): Response {
  const color = ok ? '#059669' : '#dc2626'
  const escapedTitle = escapeHtml(title)
  const escapedMessage = escapeHtml(message)
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <title>${escapedTitle}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 32rem; margin: 0 auto; }
    h1 { color: ${color}; margin-bottom: 0.5rem; }
    p { color: #374151; line-height: 1.5; }
    button { margin-top: 1.5rem; padding: 0.5rem 1rem; background: #2563eb; color: white; border: 0; border-radius: 0.375rem; cursor: pointer; }
  </style>
</head>
<body>
  <h1>${escapedTitle}</h1>
  <p>${escapedMessage}</p>
  <button onclick="window.close(); window.location.href='/import-sources'">Zurück zu den Import-Quellen</button>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'enable-banking:callback', ok: ${ok ? 'true' : 'false'} }, window.location.origin);
        setTimeout(function(){ window.close(); }, 500);
      }
    } catch (e) {}
  </script>
</body>
</html>`
  return new Response(html, {
    status: ok ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export const GET: APIRoute = async ({ url, cookies }) => {
  if (!isEnableBankingConfigured()) {
    return renderPage(
      'Enable Banking nicht konfiguriert',
      'Der Server ist nicht für Enable Banking konfiguriert.',
      false,
    )
  }

  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const stateFromUrl = url.searchParams.get('state')
  const stateFromCookie = cookies.get(EB_STATE_COOKIE)?.value
  cookies.delete(EB_STATE_COOKIE, { path: '/' })

  if (error) {
    return renderPage(
      'Autorisierung fehlgeschlagen',
      `Die Bank hat die Autorisierung abgelehnt: ${error}`,
      false,
    )
  }
  if (!code) {
    return renderPage(
      'Autorisierung fehlgeschlagen',
      'Es wurde kein Autorisierungscode zurückgegeben.',
      false,
    )
  }
  if (!stateFromCookie || !stateFromUrl || stateFromCookie !== stateFromUrl) {
    return renderPage(
      'Autorisierung fehlgeschlagen',
      'Der Status-Parameter ist ungültig oder abgelaufen. Bitte den Verbindungsvorgang neu starten.',
      false,
    )
  }

  try {
    const result = await completeConnect(code)
    const summary =
      result.sources.length === 1
        ? `Konto "${result.sources[0]!.name}" wurde verknüpft.`
        : `${result.sources.length} Konten wurden verknüpft.`
    return renderPage(
      'Bank erfolgreich verbunden',
      `${summary} Du kannst dieses Fenster schließen und in DimeTime die Synchronisierung starten.`,
      true,
    )
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Unbekannter Fehler beim Abschluss der Verbindung.'
    return renderPage('Autorisierung fehlgeschlagen', message, false)
  }
}
