import * as XLSX from 'xlsx'
import { dedupeRowsInFile } from '@/lib/bank-import/dedupe'
import { parseIngCsvFile } from '@/lib/bank-import/parsers/ing-csv'
import { parseEasybankXlsxFile } from '@/lib/bank-import/parsers/easybank-xlsx'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

async function checkIngParser() {
  const csv = [
    'Umsatzanzeige;Datei erstellt am: 17.02.2026 22:11',
    '',
    'IBAN;DE25 5001 0517 5414 3493 34',
    'Kontoname;Girokonto',
    'Bank;ING',
    '',
    'Buchung;Wertstellungsdatum;Auftraggeber/Empfänger;Buchungstext;Verwendungszweck;Saldo;Währung;Betrag;Währung',
    '17.02.2026;17.02.2026;PayPal;Lastschrift;Testzahlung;429,31;EUR;-140,47;EUR',
    '16.02.2026;16.02.2026;Arbeitgeber;Gehalt;Monat 02;569,78;EUR;3.000,00;EUR',
  ].join('\n')

  const parsed = await parseIngCsvFile('ing.csv', new TextEncoder().encode(csv))
  assert(parsed.rows.length === 2, 'ING: Erwartet wurden 2 Zeilen')
  assert(
    parsed.rows[0].amountCents === -14047,
    'ING: Betrag Zeile 1 ist falsch',
  )
  assert(
    parsed.rows[1].amountCents === 300000,
    'ING: Betrag Zeile 2 ist falsch',
  )
}

async function checkEasybankParser() {
  const rows = [
    ['Transaktionsansicht'],
    ['Kontoname', 'easybank Kreditkarte'],
    [
      'Referenznummer',
      'Buchungsdatum',
      'Buchungsdatum',
      'Betrag',
      'Beschreibung',
      'Typ',
      'Status',
      'Kartennummer',
      'Originalbetrag',
      'Land',
      'Karteninhaber',
      'Details',
    ],
    [
      '486048429150330',
      '17.02.2026',
      '17.02.2026',
      '-20,67 €',
      "McDonald's",
      'Belastung',
      'vorgemerkt',
      '490638******9791',
      '',
      'DE',
      'F VAN DER GALIEN',
      'McDonalds Bayreuth DE',
    ],
    [
      'FTGER126013000',
      '30.01.2026',
      '30.01.2026',
      '+2.100,00 €',
      'Gutschrift Echtzeitüberweisung',
      'Gutschrift',
      '-',
      '-',
      '',
      'DE',
      'F VAN DER GALIEN',
      'Echtzeitüberweisung',
    ],
  ]

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Umsätze')
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const parsed = await parseEasybankXlsxFile(
    'easybank.xlsx',
    new Uint8Array(buffer),
  )

  assert(parsed.rows.length === 2, 'easybank: Erwartet wurden 2 Zeilen')
  assert(
    parsed.rows[0].status === 'pending',
    'easybank: Zeile 1 sollte pending sein',
  )
  assert(
    parsed.rows[0].amountCents === -2067,
    'easybank: Zeile 1 Betrag ist falsch',
  )
  assert(
    parsed.rows[1].amountCents === 210000,
    'easybank: Zeile 2 Betrag ist falsch',
  )
}

async function checkFileDedup() {
  const csv = [
    'Buchung;Wertstellungsdatum;Auftraggeber/Empfänger;Buchungstext;Verwendungszweck;Saldo;Währung;Betrag;Währung',
    '17.02.2026;17.02.2026;PayPal;Lastschrift;Testzahlung;429,31;EUR;-140,47;EUR',
    '17.02.2026;17.02.2026;PayPal;Lastschrift;Testzahlung;429,31;EUR;-140,47;EUR',
  ].join('\n')

  const parsed = await parseIngCsvFile(
    'dedupe.csv',
    new TextEncoder().encode(csv),
  )
  const deduped = await dedupeRowsInFile(parsed.rows)
  assert(
    deduped.uniqueRows.length === 1,
    'Dedupe: erwartet 1 einzigartige Zeile',
  )
  assert(deduped.duplicateInFile === 1, 'Dedupe: erwartet 1 Duplikat')
}

async function main() {
  await checkIngParser()
  await checkEasybankParser()
  await checkFileDedup()
  console.log('Bank-Import-Checks erfolgreich.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
