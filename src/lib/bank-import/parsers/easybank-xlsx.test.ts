import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { parseEasybankXlsxFile } from './easybank-xlsx'

const FIXTURE_DIR = join(import.meta.dir, '__fixtures__')

function loadFixture(name: string): Uint8Array {
  return readFileSync(join(FIXTURE_DIR, name))
}

describe('parseEasybankXlsxFile', () => {
  describe('fixture: easybank-sample.xlsx', () => {
    async function parseFixture() {
      const bytes = loadFixture('easybank-sample.xlsx')
      return parseEasybankXlsxFile('easybank-export.xlsx', bytes)
    }

    it('parses full easybank export without warnings', async () => {
      const result = await parseFixture()

      expect(result.rows).toHaveLength(10)
      expect(result.warnings).toHaveLength(0)
      expect(result.meta).toEqual({
        preset: 'easybank_xlsx_v1',
        fileType: 'xlsx',
        totalRows: 10,
      })
    })

    it('treats Belastung as negative amount', async () => {
      const result = await parseFixture()

      // Row 0: REWE -45,23 € Belastung
      expect(result.rows[0]?.amountCents).toBe(-4523)

      // Row 1: Wien Energie -89,00 € Belastung
      expect(result.rows[1]?.amountCents).toBe(-8900)

      // Row 7: Miete -850,00 € Belastung
      expect(result.rows[7]?.amountCents).toBe(-85000)
    })

    it('treats Gutschrift as positive amount', async () => {
      const result = await parseFixture()

      // Row 2: Gehalt +3.250,00 € Gutschrift
      expect(result.rows[2]?.amountCents).toBe(325000)

      // Row 5: Rückzahlung +250,00 € Gutschrift
      expect(result.rows[5]?.amountCents).toBe(25000)

      // Row 9: Steuerrückerstattung +1.200,00 € Gutschrift
      expect(result.rows[9]?.amountCents).toBe(120000)
    })

    it('maps statuses correctly', async () => {
      const result = await parseFixture()

      // abgerechnet → booked
      expect(result.rows[0]?.status).toBe('booked')
      expect(result.rows[1]?.status).toBe('booked')

      // noch nicht abgerechnet → booked
      expect(result.rows[4]?.status).toBe('booked')

      // vorgemerkt → pending
      expect(result.rows[6]?.status).toBe('pending')
    })

    it('handles foreign currency transactions', async () => {
      const result = await parseFixture()

      // Row 3: Netflix -27,99 USD → -25,99 EUR
      const netflix = result.rows[3]!
      expect(netflix.amountCents).toBe(-2599)
      expect(netflix.currency).toBe('EUR')
      expect(netflix.originalAmountCents).toBe(-2799)
      expect(netflix.originalCurrency).toBe('USD')

      // Row 6: Spotify -16,99 USD → -15,90 EUR
      const spotify = result.rows[6]!
      expect(spotify.amountCents).toBe(-1590)
      expect(spotify.originalAmountCents).toBe(-1699)
      expect(spotify.originalCurrency).toBe('USD')
    })

    it('handles bank transfers without card number', async () => {
      const result = await parseFixture()

      // Row 1: Wien Energie — no card
      expect(result.rows[1]?.cardLast4).toBeNull()
      expect(result.rows[1]?.cardholder).toBeNull()

      // Row 2: Gehalt — no card
      expect(result.rows[2]?.cardLast4).toBeNull()

      // Row 5: Rückzahlung — no card
      expect(result.rows[5]?.cardLast4).toBeNull()
    })

    it('extracts last 4 digits from card number', async () => {
      const result = await parseFixture()

      // Row 0: **** **** **** 1234
      expect(result.rows[0]?.cardLast4).toBe('1234')

      // Row 6: **** **** **** 5678
      expect(result.rows[6]?.cardLast4).toBe('5678')
    })

    it('populates rawData correctly', async () => {
      const result = await parseFixture()
      const raw = result.rows[0]?.rawData

      expect(raw).toEqual({
        referenznummer: 'REF-20260214-001',
        buchungsdatum: '14.02.2026',
        wertstellungsdatum: '14.02.2026',
        betrag: '-45,23 €',
        beschreibung: 'REWE Markt Wien',
        typ: 'Belastung',
        status: 'abgerechnet',
        kartennummer: '**** **** **** 1234',
        originalbetrag: null,
        land: 'AT',
        karteninhaber: 'Anna Beispiel',
        details: 'POS Zahlung Lebensmittel',
      })
    })

    it('parses booking dates as ISO format', async () => {
      const result = await parseFixture()

      expect(result.rows[0]?.bookingDate).toBe('2026-02-14')
      expect(result.rows[0]?.valueDate).toBe('2026-02-14')

      expect(result.rows[8]?.bookingDate).toBe('2026-01-28')
      expect(result.rows[9]?.bookingDate).toBe('2026-01-15')
    })

    it('sets description, purpose, and bookingText correctly', async () => {
      const result = await parseFixture()

      // description comes from "Beschreibung" column
      expect(result.rows[0]?.description).toBe('REWE Markt Wien')

      // purpose comes from "Details" column
      expect(result.rows[0]?.purpose).toBe('POS Zahlung Lebensmittel')

      // bookingText comes from "Typ" column
      expect(result.rows[0]?.bookingText).toBe('Belastung')
    })

    it('sets country correctly', async () => {
      const result = await parseFixture()

      expect(result.rows[0]?.country).toBe('AT')
      expect(result.rows[3]?.country).toBe('US')
      expect(result.rows[6]?.country).toBe('SE')
    })
  })

  it('rejects non-XLSX files', () => {
    const bytes = new Uint8Array([0])

    expect(() => parseEasybankXlsxFile('export.csv', bytes)).toThrow(
      'Ungültiger Dateityp',
    )
  })
})
