import { describe, expect, it } from 'bun:test'
import { setupTestDb } from '@/lib/__fixtures__/test-setup'

setupTestDb()
const { GET } = await import('./import-types')

describe('GET /api/import-types', () => {
  it('publishes the supported import formats and their required columns', async () => {
    const response = (await GET({} as never)) as Response
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/json')
    expect(await response.json()).toEqual({
      importTypes: [
        {
          preset: 'ing_csv_v1',
          name: 'ING (CSV)',
          extensions: ['.csv'],
          requiredColumns: [
            'Buchung',
            'Wertstellungsdatum',
            'Auftraggeber/Empfänger',
            'Buchungstext',
            'Verwendungszweck',
            'Saldo',
            'Betrag',
          ],
        },
        {
          preset: 'easybank_xlsx_v1',
          name: 'easybank (XLSX)',
          extensions: ['.xlsx'],
          requiredColumns: [
            'Referenznummer',
            'Buchungsdatum',
            'Betrag',
            'Beschreibung',
            'Typ',
            'Status',
          ],
        },
        {
          preset: 'amazon_visa_xls_v1',
          name: 'Amazon Visa (XLS)',
          extensions: ['.xls'],
          requiredColumns: ['Datum', 'Zeit', 'Karte', 'Beschreibung', 'Betrag'],
        },
      ],
    })
  })
})
