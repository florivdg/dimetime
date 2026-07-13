/**
 * Run with: bun run src/lib/bank-import/parsers/__fixtures__/generate-amazon-visa-fixture.ts
 *
 * Generates an anonymized Amazon Visa XLS (BIFF) fixture for unit tests.
 */
import * as XLSX from 'xlsx'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const metadataRows: (string | null)[][] = [
  [],
  ['Amazon Visa - Umsätze '],
  [],
  ['Datum der Belastung: ', '11/07/2026 08:42h'],
  ['Karteninhaber: ', 'ANNA BEISPIEL'],
  ['Referenzkonto:', 'DE00123456780000000000'],
  ['Zeitraum der Bewegung: ', '11.07.2024 - '],
  ['Kreditkartenlimit:', '3.000,00 €'],
  ['Verbraucht:', '556,98 €'],
  [],
]

const headerRow = [
  'Datum',
  'Zeit',
  'Karte',
  'Beschreibung',
  'Umsatzkategorie',
  'Unterkategorie',
  'Betrag',
  'Punkte',
]

// Real exports contain a blank row between header and data, plus trailing
// spaces in the Datum column — both quirks are reproduced here.
const dataRows: (string | null)[][] = [
  [
    '29.06.2026 ',
    '11:53 Uhr',
    '************9358',
    'AMAZON 882ZY3B95',
    'Handel und Geschäfte',
    'Sonstige (Handel und Geschäfte)',
    '-6,99 €',
    '+6',
  ],
  [
    '25.06.2026 ',
    '02:33 Uhr',
    '************9358',
    'Startgutschrift',
    'Einkommen',
    'Sonstiges (Einkommen)',
    '+50,00 €',
    '0',
  ],
  [
    '24.06.2026 ',
    '13:10 Uhr',
    '************9358',
    'AMZN Mktp DE 3I0FS31S5',
    'Handel und Geschäfte',
    'Sonstige (Handel und Geschäfte)',
    '-1.599,99 €',
    '0',
  ],
  // Two purchases on the same day at the same merchant with the same
  // amount — only Zeit differs (dedupe scenario).
  [
    '20.06.2026 ',
    '09:15 Uhr',
    '************9358',
    'AMZN Mktp DE 7XQ2R81T2',
    'Handel und Geschäfte',
    'Sonstige (Handel und Geschäfte)',
    '-19,99 €',
    '0',
  ],
  [
    '20.06.2026 ',
    '18:47 Uhr',
    '************9358',
    'AMZN Mktp DE 7XQ2R81T2',
    'Handel und Geschäfte',
    'Sonstige (Handel und Geschäfte)',
    '-19,99 €',
    '0',
  ],
]

const allRows = [...metadataRows, headerRow, [], ...dataRows]
const ws = XLSX.utils.aoa_to_sheet(allRows)
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'abrechnung Antrags1.dt.')

const outputPath = join(__dirname, 'amazon-visa-sample.xls')
const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'biff8' })
writeFileSync(outputPath, buffer)

console.log(`Generated: ${outputPath}`)
