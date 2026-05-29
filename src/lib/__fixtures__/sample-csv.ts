/** Minimal valid ING CSV: header + one Edeka expense row. */
export const SAMPLE_ING_CSV = [
  'Buchung;Wertstellungsdatum;Auftraggeber/Empfänger;Buchungstext;Verwendungszweck;Saldo;Währung;Betrag;Währung',
  '01.03.2026;02.03.2026;Edeka;Lastschrift;Einkauf;1500,00;EUR;-45,00;EUR',
].join('\n')

/** Income row appended in service-level tests that need a credit. */
export const SAMPLE_ING_CSV_INCOME_ROW =
  '05.03.2026;05.03.2026;Lohn;Gutschrift;März;1545,00;EUR;1900,00;EUR'

/** Wrap CSV text in a `text/csv` File for multipart upload tests. */
export function makeCsvFile(
  content: string = SAMPLE_ING_CSV,
  name = 'statement.csv',
): File {
  return new File([content], name, { type: 'text/csv' })
}
