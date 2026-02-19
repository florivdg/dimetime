/**
 * Run with: bun run src/lib/bank-import/parsers/__fixtures__/generate-easybank-fixture.ts
 *
 * Generates an anonymized easybank XLSX fixture for unit tests.
 */
import * as XLSX from 'xlsx'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const metadataRows: (string | null)[][] = [
  ['Transaktionsansicht'],
  [],
  ['Kontonummer', '1234567890'],
  ['IBAN', 'AT48 2011 1822 1234 5678'],
  ['Kontoname', 'Anna Beispiel'],
  ['Kontotyp', 'Girokonto'],
  ['Währung', 'EUR'],
  [],
  ['Zeitraum', '01.01.2026 - 15.02.2026'],
  ['Exportdatum', '15.02.2026'],
  [],
  [],
]

const headerRow = [
  'Referenznummer',
  'Buchungsdatum',
  'Buchungsdatum',
  'Betrag',
  'Beschreibung',
  'Typ',
  'Status',
  'Kartennummer',
  'Originalbetrag',
  'Mögliche Zahlpläne',
  'Land',
  'Karteninhaber',
  'Kartennetzwerk',
  'Kontaktlose Bezahlung',
  'Details',
]

const dataRows: (string | null)[][] = [
  // 1. Card debit, booked, contactless
  [
    'REF-20260214-001',
    '14.02.2026',
    '14.02.2026',
    '-45,23 €',
    'REWE Markt Wien',
    'Belastung',
    'abgerechnet',
    '**** **** **** 1234',
    '',
    '',
    'AT',
    'Anna Beispiel',
    'VISA',
    'Ja',
    'POS Zahlung Lebensmittel',
  ],
  // 2. Bank transfer debit, booked, no card
  [
    'REF-20260213-002',
    '13.02.2026',
    '13.02.2026',
    '-89,00 €',
    'Wien Energie GmbH',
    'Belastung',
    'abgerechnet',
    '',
    '',
    '',
    'AT',
    '',
    '',
    '',
    'Abbuchung Strom Februar',
  ],
  // 3. Salary credit, booked, no card
  [
    'REF-20260210-003',
    '10.02.2026',
    '10.02.2026',
    '+3.250,00 €',
    'Firma Muster GmbH',
    'Gutschrift',
    'abgerechnet',
    '',
    '',
    '',
    'AT',
    '',
    '',
    '',
    'Gehalt Februar 2026',
  ],
  // 4. Foreign currency debit (USD), booked
  [
    'REF-20260209-004',
    '09.02.2026',
    '09.02.2026',
    '-25,99 €',
    'Netflix International B.V.',
    'Belastung',
    'abgerechnet',
    '**** **** **** 1234',
    '-27,99 USD',
    '',
    'US',
    'Anna Beispiel',
    'VISA',
    'Nein',
    'Streaming Monatsabo',
  ],
  // 5. Card debit, "noch nicht abgerechnet"
  [
    'REF-20260207-005',
    '07.02.2026',
    '07.02.2026',
    '-120,50 €',
    'Hotel Sacher Wien',
    'Belastung',
    'noch nicht abgerechnet',
    '**** **** **** 1234',
    '',
    '',
    'AT',
    'Anna Beispiel',
    'VISA',
    'Ja',
    'Restaurant Abendessen',
  ],
  // 6. Credit from person, booked, no card
  [
    'REF-20260205-006',
    '05.02.2026',
    '05.02.2026',
    '+250,00 €',
    'Maria Schmidt',
    'Gutschrift',
    'abgerechnet',
    '',
    '',
    '',
    'AT',
    '',
    '',
    '',
    'Rückzahlung Konzerttickets',
  ],
  // 7. Foreign currency debit (USD), "vorgemerkt", different card
  [
    'REF-20260203-007',
    '03.02.2026',
    '03.02.2026',
    '-15,90 €',
    'Spotify AB',
    'Belastung',
    'vorgemerkt',
    '**** **** **** 5678',
    '-16,99 USD',
    '',
    'SE',
    'Anna Beispiel',
    'Mastercard',
    'Nein',
    'Musik Premium Abo',
  ],
  // 8. Rent debit, booked, no card
  [
    'REF-20260201-008',
    '01.02.2026',
    '01.02.2026',
    '-850,00 €',
    'Hausverwaltung Wien GmbH',
    'Belastung',
    'abgerechnet',
    '',
    '',
    '',
    'AT',
    '',
    '',
    '',
    'Miete Februar 2026',
  ],
  // 9. Card debit, booked, contactless
  [
    'REF-20260128-009',
    '28.01.2026',
    '28.01.2026',
    '-32,45 €',
    'BILLA AG Filiale 123',
    'Belastung',
    'abgerechnet',
    '**** **** **** 1234',
    '',
    '',
    'AT',
    'Anna Beispiel',
    'VISA',
    'Ja',
    'Einkauf Lebensmittel',
  ],
  // 10. Tax refund credit, booked, no card
  [
    'REF-20260115-010',
    '15.01.2026',
    '15.01.2026',
    '+1.200,00 €',
    'Finanzamt Wien',
    'Gutschrift',
    'abgerechnet',
    '',
    '',
    '',
    'AT',
    '',
    '',
    '',
    'Steuerrückerstattung 2025',
  ],
]

const allRows = [...metadataRows, headerRow, ...dataRows]
const ws = XLSX.utils.aoa_to_sheet(allRows)
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Transaktionen')

const outputPath = join(__dirname, 'easybank-sample.xlsx')
const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
writeFileSync(outputPath, buffer)

console.log(`Generated: ${outputPath}`)
