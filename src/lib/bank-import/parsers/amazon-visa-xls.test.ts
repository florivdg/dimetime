import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'
import * as XLSX from 'xlsx'
import { parseAmazonVisaXlsFile } from './amazon-visa-xls'
import { buildDedupeKey } from '@/lib/bank-import/dedupe-key'

const FIXTURE_DIR = join(import.meta.dir, '__fixtures__')

function loadFixture(name: string): Uint8Array {
  return readFileSync(join(FIXTURE_DIR, name))
}

function buildXlsBytes(rows: (string | number)[][]): Uint8Array {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Blatt1')
  return new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType: 'biff8' }))
}

describe('parseAmazonVisaXlsFile', () => {
  describe('fixture: amazon-visa-sample.xls', () => {
    // Parsed once and shared — the parser is pure and tests only read the result.
    const fixturePromise = parseAmazonVisaXlsFile(
      'Umsätze_Amazon_Visa.xls',
      loadFixture('amazon-visa-sample.xls'),
    )

    function parseFixture() {
      return fixturePromise
    }

    it('parses full Amazon Visa export without warnings', async () => {
      const result = await parseFixture()

      expect(result.rows).toHaveLength(5)
      expect(result.warnings).toHaveLength(0)
      expect(result.meta).toEqual({
        preset: 'amazon_visa_xls_v1',
        fileType: 'xls',
        totalRows: 5,
      })
    })

    it('keeps signed amounts from the Betrag column', async () => {
      const result = await parseFixture()

      expect(result.rows[0]?.amountCents).toBe(-699)
      expect(result.rows[1]?.amountCents).toBe(5000)
      expect(result.rows[2]?.amountCents).toBe(-159999)
      expect(result.rows[0]?.currency).toBe('EUR')
    })

    it('parses booking dates as ISO format despite trailing spaces', async () => {
      const result = await parseFixture()

      expect(result.rows[0]?.bookingDate).toBe('2026-06-29')
      expect(result.rows[1]?.bookingDate).toBe('2026-06-25')
      expect(result.rows[2]?.bookingDate).toBe('2026-06-24')
    })

    it('extracts last 4 digits from masked card number', async () => {
      const result = await parseFixture()

      expect(result.rows[0]?.cardLast4).toBe('9358')
    })

    it('applies the cardholder from the metadata block to every row', async () => {
      const result = await parseFixture()

      for (const row of result.rows) {
        expect(row.cardholder).toBe('ANNA BEISPIEL')
      }
    })

    it('marks all rows as booked without external transaction id', async () => {
      const result = await parseFixture()

      for (const row of result.rows) {
        expect(row.status).toBe('booked')
        expect(row.externalTransactionId).toBeNull()
      }
    })

    it('maps Zeit to bookingText and Beschreibung to description', async () => {
      const result = await parseFixture()

      expect(result.rows[0]?.bookingText).toBe('11:53 Uhr')
      expect(result.rows[0]?.description).toBe('AMAZON 882ZY3B95')
      expect(result.rows[0]?.counterparty).toBeNull()
      expect(result.rows[0]?.purpose).toBeNull()
    })

    it('yields distinct dedupe keys for same-day same-amount purchases', async () => {
      const result = await parseFixture()

      // Rows 3 and 4 differ only in Zeit
      const keyA = await buildDedupeKey(result.rows[3]!)
      const keyB = await buildDedupeKey(result.rows[4]!)

      expect(keyA).not.toBe(keyB)
    })

    it('populates rawData correctly', async () => {
      const result = await parseFixture()

      expect(result.rows[0]?.rawData).toEqual({
        datum: '29.06.2026',
        zeit: '11:53 Uhr',
        karte: '************9358',
        beschreibung: 'AMAZON 882ZY3B95',
        umsatzkategorie: 'Handel und Geschäfte',
        unterkategorie: 'Sonstige (Handel und Geschäfte)',
        betrag: '-6,99 €',
        punkte: '+6',
      })
    })
  })

  it('skips rows with dot-decimal amounts instead of misreading them', async () => {
    // Numeric Betrag cells are rendered as "-6.99" by sheet_to_json;
    // importing them via parseGermanMoney would multiply amounts by 100.
    const bytes = buildXlsBytes([
      ['Datum', 'Zeit', 'Karte', 'Beschreibung', 'Betrag'],
      ['29.06.2026', '11:53 Uhr', '************9358', 'AMAZON TEST', -6.99],
      ['28.06.2026', '10:00 Uhr', '************9358', 'AMAZON OK', '-7,99 €'],
    ])

    const result = await parseAmazonVisaXlsFile('export.xls', bytes)

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.amountCents).toBe(-799)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('übersprungen')
  })

  it('rejects non-XLS files', () => {
    const bytes = new Uint8Array([0])

    expect(() => parseAmazonVisaXlsFile('export.xlsx', bytes)).toThrow(
      'Ungültiger Dateityp',
    )
  })

  it('rejects files without the expected header row', () => {
    const bytes = buildXlsBytes([
      ['Irgendwas', 'Anderes'],
      ['01.01.2026', '-1,00 €'],
    ])

    expect(() => parseAmazonVisaXlsFile('export.xls', bytes)).toThrow(
      'Kopfzeile nicht gefunden',
    )
  })
})
