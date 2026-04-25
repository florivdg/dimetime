# Companion-API: Bank-Transaktionen ingestieren

Technische Referenz für Entwicklerinnen und Entwickler von Companion-Apps, die Banktransaktionen automatisiert in DimeTime einliefern.

## Überblick

Die Companion-API ist ein HTTP-Endpoint, über den eine externe Anwendung (z.B. eine Desktop-/Mobile-Companion-App, die PSD2- oder Screen-Scraping-Kanäle kapselt) Banktransaktionen in DimeTime schreibt. Sie ist ein zusätzlicher Import-Kanal neben dem manuellen CSV- (ING) und XLSX- (Easybank) Upload und nutzt dieselbe Upsert-/Dedup-Logik wie diese — eine Transaktion, die sowohl per Companion-App als auch per CSV gemeldet wird, wird korrekt zusammengeführt.

**Kernmerkmale**

- Authentifizierung über scoped Better-Auth-API-Key (`bank_transactions: ['write']`).
- Ein Key gehört zu einem Benutzer und darf in beliebige bestehende `importSource`-Einträge (z.B. ING + Easybank parallel) schreiben. `importSource` legt der Benutzer vorher einmalig in der UI an.
- Batch-Insert bis 500 Zeilen pro Request.
- Idempotenz über `externalTransactionId` oder einen semantischen Fallback-Hash.
- Automatisches pending→booked-Upgrade: sobald eine Transaktion mit `status: "booked"` geliefert wird, für die bereits eine pending-Row existiert, wird das Bestandsrecord aktualisiert (kein Duplikat).
- Plan-Zuordnung (wenn die `importSource` `defaultPlanAssignment: 'auto_month'` nutzt, wird neu eingelieferten Transaktionen der passende Monatsplan zugewiesen, sofern eindeutig).

## Einrichtung

### 1. API-Key erzeugen

In der DimeTime-Webanwendung unter **Einstellungen → Companion-App-Keys**:

1. **Key erstellen** klicken.
2. Einen sprechenden Namen wählen (z.B. `Companion Desktop`).
3. Ablauf wählen (30/90 Tage, 1 Jahr oder kein Ablauf).

Der Klartext-Key wird **genau einmal** angezeigt und beginnt mit `dt_`. Kopiere ihn sofort in einen sicheren Speicher der Companion-App (Keychain, verschlüsselte Config). Die Liste in den Einstellungen zeigt danach nur noch Prefix und Start-Fragment.

Keys lassen sich jederzeit widerrufen (Trash-Icon in der Liste). Ein widerrufener Key liefert sofort `401`.

### 2. sourceId ermitteln

Jede Transaktion gehört zu einer `importSource` (Bank-/Kreditkartenkonto). Der Nutzer legt Quellen in der DimeTime-UI unter **Import-Quellen** an. Die Companion-App muss wissen, welche `sourceId` sie für welches Bankkonto verwendet. Empfohlene Vorgehensweise: Benutzer beim Setup der Companion-App einmalig eine Zuordnung `Bankkonto → sourceId` konfigurieren lassen.

Die `sourceId` ist die UUID aus der DimeTime-UI (sichtbar in den Import-Quellen-Detailansichten).

## Endpoint

```
POST /api/ingest/bank-transactions
```

**Header**

| Header         | Wert                  | Pflicht |
| -------------- | --------------------- | ------- |
| `x-api-key`    | `dt_…` (Klartext-Key) | ja      |
| `Content-Type` | `application/json`    | ja      |

**Request-Body**

Der JSON-Body darf maximal 1 MiB groß sein.

```jsonc
{
  "sourceId": "94673667-8498-4eaf-8c38-4fb8e0bef704",
  "rows": [
    {
      "externalTransactionId": "bank-ref-abc-123",
      "bookingDate": "2026-04-20",
      "valueDate": "2026-04-21",
      "amountCents": -4299,
      "currency": "EUR",
      "counterparty": "Edeka Mitte",
      "bookingText": "KARTENZAHLUNG",
      "description": null,
      "purpose": "Lebensmittel",
      "status": "booked",
      "balanceAfterCents": 123456,
      "balanceCurrency": "EUR",
      "country": "DE",
      "cardLast4": "1234",
      "cardholder": "Max Mustermann",
      "originalAmountCents": null,
      "originalCurrency": null,
      "rawData": { "raw_field_1": "value", "raw_field_2": null },
    },
  ],
}
```

### Feldreferenz

| Feld                           | Typ                                    | Pflicht | Beschreibung                                                                                                                                     |
| ------------------------------ | -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sourceId`                     | UUID (string)                          | ja      | Ziel-`importSource`. Muss existieren und aktiv sein.                                                                                             |
| `rows`                         | Array (1–500)                          | ja      | Batch von Transaktionen. `min=1`, `max=500`.                                                                                                     |
| `rows[].externalTransactionId` | string / null                          | nein    | Stabile ID aus der Quelle (z.B. Bank-/API-Transaktionsreferenz). Wird — sofern gesetzt — als dedupeKey verwendet. **Empfohlen**, wenn vorhanden. |
| `rows[].bookingDate`           | string `YYYY-MM-DD`                    | ja      | Buchungsdatum.                                                                                                                                   |
| `rows[].valueDate`             | string `YYYY-MM-DD` / null             | nein    | Wertstellungsdatum.                                                                                                                              |
| `rows[].amountCents`           | integer                                | ja      | Betrag in Minor-Units (Cent). Negativ = Ausgabe, positiv = Eingang.                                                                              |
| `rows[].currency`              | string(3)                              | nein    | ISO-4217-Code, Default `"EUR"`. Wird vor Persistenz und Dedup auf Großschreibung normalisiert.                                                   |
| `rows[].counterparty`          | string / null                          | nein    | Empfänger/Auftraggeber.                                                                                                                          |
| `rows[].bookingText`           | string / null                          | nein    | Buchungstext der Bank (z.B. `"SEPA-ÜBERWEISUNG"`).                                                                                               |
| `rows[].description`           | string / null                          | nein    | Zusätzliche Beschreibung.                                                                                                                        |
| `rows[].purpose`               | string / null                          | nein    | Verwendungszweck.                                                                                                                                |
| `rows[].status`                | `"booked"` / `"pending"` / `"unknown"` | nein    | Default `"unknown"`. Für das pending→booked-Upgrade relevant.                                                                                    |
| `rows[].balanceAfterCents`     | integer / null                         | nein    | Kontostand nach der Buchung (in Cent).                                                                                                           |
| `rows[].balanceCurrency`       | string(3) / null                       | nein    | Währung des Saldos. Wird auf Großschreibung normalisiert.                                                                                        |
| `rows[].country`               | string / null                          | nein    | Ländercode der Transaktion (z.B. Kartenzahlung im Ausland).                                                                                      |
| `rows[].cardLast4`             | string / null                          | nein    | Letzte 4 Stellen der verwendeten Karte.                                                                                                          |
| `rows[].cardholder`            | string / null                          | nein    | Kartenhalter.                                                                                                                                    |
| `rows[].originalAmountCents`   | integer / null                         | nein    | Betrag in Originalwährung (z.B. Fremdwährungszahlung).                                                                                           |
| `rows[].originalCurrency`      | string(3) / null                       | nein    | Originalwährung. Wird auf Großschreibung normalisiert.                                                                                           |
| `rows[].rawData`               | `Record<string, string\|null>`         | nein    | Rohfelder aus der Quell-API. Maximal 50 Felder, Schlüssel maximal 100 Zeichen, Werte maximal 2000 Zeichen. Wird als JSON persistiert.            |

### Response (200)

```json
{
  "importId": "885e2dab-e95f-4f61-a749-d3aa3366013a",
  "inserted": 1,
  "updated": 0,
  "skipped": 0,
  "assigned": 1,
  "unassigned": 0,
  "warnings": []
}
```

| Feld         | Bedeutung                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| `importId`   | ID des Import-Logs (`statement_import.id`, Phase `commit`, `file_type: "api"`).                         |
| `inserted`   | Anzahl neu angelegter Transaktionen.                                                                    |
| `updated`    | Anzahl aktualisierter Transaktionen (Dedup-Treffer oder pending→booked-Upgrade).                        |
| `skipped`    | Rows, die innerhalb des Batches als Duplikat verworfen wurden (gleicher dedupeKey mehrfach im Request). |
| `assigned`   | Wie viele Transaktionen nach dem Call einem Monatsplan zugeordnet sind.                                 |
| `unassigned` | Wie viele nicht zugeordnet werden konnten (keine eindeutige `plan`-Row für den Monat).                  |
| `warnings`   | Menschlesbare Hinweise, z.B. `"1 ausstehende Transaktionen werden auf 'Gebucht' aktualisiert."`.        |

### Fehler-Responses

| HTTP | `error`-Body                                     | Ursache                                                                    |
| ---- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| 400  | `"Ungültiger JSON-Body"`                         | Body ist kein valides JSON.                                                |
| 400  | Zod-Validation-Message                           | Schema-Verletzung (z.B. `bookingDate` fehlt, leeres `rows`, Batch > 500).  |
| 400  | `"Import-Quelle ist deaktiviert"`                | `importSource.isActive = false`.                                           |
| 401  | `"Nicht autorisiert"`                            | Kein `x-api-key`-Header gesetzt.                                           |
| 401  | `"Invalid API key."` bzw. `"Ungültiger API-Key"` | Key unbekannt, widerrufen, abgelaufen oder ohne `bank_transactions:write`. |
| 404  | `"Import-Quelle nicht gefunden"`                 | `sourceId` existiert nicht.                                                |
| 413  | `"JSON-Body ist zu groß"`                        | JSON-Body überschreitet 1 MiB.                                             |

## Deduplikation

Für jede Row wird ein `dedupeKey` berechnet:

1. Wenn `externalTransactionId` gesetzt ist: `sha256("external:" + externalTransactionId.toLowerCase())`.
2. Andernfalls: `sha256(bookingDate | valueDate | amountCents | currency | balanceAfterCents | balanceCurrency | counterparty | bookingText | description | purpose | country | cardLast4 | cardholder)` — alle Strings auf Kleinschreibung normalisiert.

Unique-Constraint in der DB: `(sourceId, dedupeKey)`. Beim Insert läuft ein `ON CONFLICT DO UPDATE` gegen dieses Paar.

**Konsequenzen**

- Liefere `externalTransactionId`, wann immer die Quelle eine stabile ID hat. Das ist der robusteste Dedup-Pfad auch über Format-Changes der Bank hinweg.
- Ohne `externalTransactionId`: minimale Änderungen an Rohfeldern (z.B. Leerzeichen in `counterparty`) erzeugen einen anderen Hash → neue Row. Stabilität der Feldnormalisierung liegt bei der Companion-App.
- Wird ein Key widerverwendet und der Request wiederholt (z.B. nach Netzwerkfehler), ist das sicher: die Transaktion wird aktualisiert, nicht dupliziert.

### pending → booked

Wenn ein Batch `status: "booked"`-Rows enthält, die keinen direkten dedupeKey-Match haben, sucht der Ingest nach bestehenden `pending`-Rows auf demselben `bookingDate` + `amountCents` + `description` (semantischer Schlüssel). Findet er einen, wird die existierende Row auf `booked` aktualisiert (1:1-Matching), statt eine neue einzufügen. Der Response meldet das als `updated` + Warnung.

### Manuell gesetzte Plan-Zuordnungen bleiben erhalten

Wenn eine Nutzerin eine bestehende Transaktion einem Plan manuell zugewiesen hat (`planAssignment = 'manual'` oder `planId != null`), überschreibt ein Ingest-Upsert diese Zuordnung **nicht** — selbst wenn der Importer ansonsten automatisch zuweisen würde.

## Rate Limits

- **Pro Key**: 120 Requests pro 60 s (Default im Better-Auth-API-Key-Plugin).
- **Global** im DimeTime-Rate-Limiter (`/api-key/*`): 20/60 s für Key-Management-Endpoints. Ingest selbst fällt unter das App-Default 100/60 s.

Bei Überschreitung liefert der Auth-Layer HTTP 429.

## Sicherheitshinweise

- Der Key ist ein Bearer-ähnliches Credential. Lege ihn nie in Source Control ab, logge ihn nicht, übertrage nur über TLS.
- Scope des Keys ist exakt `bank_transactions: ['write']`. Auch bei Kompromittierung kann ein Angreifer ausschließlich Banktransaktionen schreiben/aktualisieren — kein Leseweg, keine anderen Routen (die Middleware prüft den Scope explizit).
- Ein kompromittierter Key lässt sich jederzeit in der UI widerrufen.
- DimeTime erzwingt 2FA für Web-Sessions. Dieser 2FA-Check greift für `/api/ingest/*` bewusst **nicht**, weil die Companion-App nicht interaktiv ist. Die Sicherheit liegt in der engen Scope-Definition des Keys.

## Beispiel: curl

### Einzelimport

```bash
curl -X POST https://dimetime.example/api/ingest/bank-transactions \
  -H "x-api-key: dt_…" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceId": "94673667-8498-4eaf-8c38-4fb8e0bef704",
    "rows": [{
      "externalTransactionId": "bank-tx-001",
      "bookingDate": "2026-04-20",
      "amountCents": -4299,
      "currency": "EUR",
      "counterparty": "Edeka",
      "status": "booked"
    }]
  }'
```

### Batch-Import

```bash
curl -X POST https://dimetime.example/api/ingest/bank-transactions \
  -H "x-api-key: dt_…" \
  -H "Content-Type: application/json" \
  --data-binary @batch.json
```

Mit `batch.json`:

```json
{
  "sourceId": "94673667-8498-4eaf-8c38-4fb8e0bef704",
  "rows": [
    {
      "externalTransactionId": "tx-001",
      "bookingDate": "2026-04-20",
      "amountCents": -1299,
      "status": "booked"
    },
    {
      "externalTransactionId": "tx-002",
      "bookingDate": "2026-04-21",
      "amountCents": 899,
      "status": "booked"
    },
    {
      "externalTransactionId": "tx-003",
      "bookingDate": "2026-04-22",
      "amountCents": -4299,
      "status": "booked"
    }
  ]
}
```

## Empfohlene Client-Architektur

- **Queue + Retry**: Versende in Batches (z.B. alle n Transaktionen oder periodisch), mit exponentiellem Backoff bei 5xx.
- **Idempotenz durch Retries**: Dank Upsert sind Wiederholungen derselben Batches sicher — kein Dedup-State auf Client-Seite nötig.
- **Kurze Batches**: Max 500 hart; sinnvoll sind meist 50–200 pro Request (geringere Transaktionszeit, kleinere Fehlerflächen).
- **Rohdaten mitschicken**: Lege `rawData` mit den Originalfeldern der Bank-API ab. Erleichtert spätere Reconciliation und Debugging.
- **Clock-Skew**: Nutze Bank-Zeitstempel (`bookingDate`), nicht `Date.now()` des Clients.
- **Key-Rotation**: Neuen Key erstellen → Companion-App umkonfigurieren → alten Key widerrufen. Keine Downtime nötig.

## Interna (für Reviewer)

- Endpoint-Implementierung: `src/pages/api/ingest/bank-transactions.ts`
- Middleware-Auth-Zweig: `src/middleware.ts` (Pfad-Präfix `/api/ingest/*`, Permissions-Check via `auth.api.verifyApiKey`).
- Upsert-Kern: `src/lib/bank-import/service.ts:upsertNormalizedBankTransactions`; der CSV-/XLSX-Import teilt mit diesem Helper die `prepareFromNormalizedRows`- und `persistUpsert`-Phase.
- Key-Erzeugung mit festem Scope: `src/pages/api/settings/companion-keys.ts` (serverseitig `auth.api.createApiKey({ permissions: { bank_transactions: ['write'] } })`).
- Audit-Trail: Jeder Ingest-Call schreibt eine Row in `statement_import` mit `file_type = 'api'`, `phase = 'commit'`. Fehler werden als `phase = 'commit'`, `status = 'failed'` protokolliert.
