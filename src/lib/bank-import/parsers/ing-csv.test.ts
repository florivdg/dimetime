import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { parseIngCsvFile } from './ing-csv'

const FIXTURE_DIR = join(import.meta.dir, '__fixtures__')

/** Read UTF-8 fixture and re-encode as ISO-8859-1 bytes (matching real ING exports). */
function loadFixtureAsLatin1(name: string): Uint8Array {
  const text = readFileSync(join(FIXTURE_DIR, name), 'utf-8')
  return Buffer.from(text, 'latin1')
}

describe('parseIngCsvFile', () => {
  it('parses quoted multiline fields with semicolons and escaped quotes', async () => {
    const csv = [
      'Umsatzanzeige;Datei erstellt am: 17.02.2026 22:11',
      '',
      'IBAN;DE25 5001 0517 5414 3493 34',
      'Kontoname;Girokonto',
      'Bank;ING',
      '',
      'Buchung;Wertstellungsdatum;Auftraggeber/Empfänger;Buchungstext;Verwendungszweck;Saldo;Währung;Betrag;Währung',
      '17.02.2026;17.02.2026;PayPal;Lastschrift;"Erste Zeile',
      'zweite Zeile; mit Semikolon und ""Zitat""";429,31;EUR;-140,47;EUR',
    ].join('\n')

    const parsed = await parseIngCsvFile(
      'ing.csv',
      new TextEncoder().encode(csv),
    )

    expect(parsed.rows).toHaveLength(1)
    expect(parsed.rows[0]?.amountCents).toBe(-14047)
    expect(parsed.rows[0]?.purpose).toBe(
      'Erste Zeile zweite Zeile; mit Semikolon und "Zitat"',
    )
  })

  it('skips invalid rows and produces warnings', async () => {
    const csv = [
      'Buchung;Wertstellungsdatum;Auftraggeber/Empfänger;Buchungstext;Verwendungszweck;Saldo;Währung;Betrag;Währung',
      '17.02.2026;17.02.2026;PayPal;Lastschrift;Testzahlung;429,31;EUR;-140,47;EUR',
      'kein-datum;17.02.2026;Arbeitgeber;Gehalt;Monat 02;569,78;EUR;3.000,00;EUR',
    ].join('\n')

    const parsed = await parseIngCsvFile(
      'ing.csv',
      new TextEncoder().encode(csv),
    )

    expect(parsed.rows).toHaveLength(1)
    expect(parsed.warnings).toHaveLength(1)
    expect(parsed.warnings[0]).toContain('konnte nicht importiert werden')
  })

  describe('fixture: ing-sample.csv', () => {
    async function parseFixture() {
      const bytes = loadFixtureAsLatin1('ing-sample.csv')
      return parseIngCsvFile('ing-export.csv', bytes)
    }

    it('parses full ING export without warnings', async () => {
      const result = await parseFixture()

      expect(result.rows).toHaveLength(10)
      expect(result.warnings).toHaveLength(0)
      expect(result.meta).toEqual({
        preset: 'ing_csv_v1',
        fileType: 'csv',
        totalRows: 10,
      })
    })

    it('parses amounts and balances correctly', async () => {
      const result = await parseFixture()

      // Row 0: REWE -45,23 €, Saldo 4.523,89 €
      expect(result.rows[0]?.amountCents).toBe(-4523)
      expect(result.rows[0]?.balanceAfterCents).toBe(452389)
      expect(result.rows[0]?.currency).toBe('EUR')

      // Row 3: Gehalt +3.250,00 €
      expect(result.rows[3]?.amountCents).toBe(325000)
      expect(result.rows[3]?.balanceAfterCents).toBe(469811)

      // Row 5: Finanzamt -350,00 €
      expect(result.rows[5]?.amountCents).toBe(-35000)

      // Row 9: Miete -850,00 €
      expect(result.rows[9]?.amountCents).toBe(-85000)
      expect(result.rows[9]?.balanceAfterCents).toBe(130361)
    })

    it('parses all booking text types', async () => {
      const result = await parseFixture()
      const types = result.rows.map((r) => r.bookingText)

      expect(types).toContain('Lastschrift')
      expect(types).toContain('Dauerauftrag/Terminueberweisung')
      expect(types).toContain('Gehalt/Rente')
      expect(types).toContain('Echtzeitüberweisung')
      expect(types).toContain('Überweisung')
      expect(types).toContain('Retouren')
      expect(types).toContain('Gutschrift')
    })

    it('parses booking date and value date as ISO format', async () => {
      const result = await parseFixture()

      expect(result.rows[0]?.bookingDate).toBe('2026-02-14')
      expect(result.rows[0]?.valueDate).toBe('2026-02-14')

      // Row 8: 28.01.2026
      expect(result.rows[8]?.bookingDate).toBe('2026-01-28')
      expect(result.rows[8]?.valueDate).toBe('2026-01-28')

      // Row 9: 15.01.2026
      expect(result.rows[9]?.bookingDate).toBe('2026-01-15')
    })

    it('populates rawData correctly', async () => {
      const result = await parseFixture()
      const raw = result.rows[0]?.rawData

      expect(raw).toEqual({
        buchung: '14.02.2026',
        wertstellungsdatum: '14.02.2026',
        auftraggeberEmpfaenger: 'REWE Markt GmbH',
        buchungstext: 'Lastschrift',
        verwendungszweck: 'REWE SAGT DANKE 12345678',
        saldo: '4.523,89',
        saldoWaehrung: 'EUR',
        betrag: '-45,23',
        betragWaehrung: 'EUR',
      })
    })

    it('sets ING-specific fields correctly', async () => {
      const result = await parseFixture()
      const row = result.rows[0]!

      expect(row.status).toBe('booked')
      expect(row.externalTransactionId).toBeNull()
      expect(row.originalAmountCents).toBeNull()
      expect(row.originalCurrency).toBeNull()
      expect(row.cardLast4).toBeNull()
      expect(row.cardholder).toBeNull()
      expect(row.country).toBeNull()
      expect(row.description).toBeNull()
    })
  })

  it('rejects non-CSV files', () => {
    const bytes = new Uint8Array([0])

    expect(() => parseIngCsvFile('export.xlsx', bytes)).toThrow(
      'Ungültiger Dateityp',
    )
  })
})
