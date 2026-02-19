import { describe, expect, it } from 'bun:test'
import { parseIngCsvFile } from './ing-csv'

describe('parseIngCsvFile', () => {
  it('parst quoted multiline-Felder mit Semikolon und escaped quotes korrekt', async () => {
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

  it('überspringt ungültige Zeilen und liefert Warnungen', async () => {
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
})
