/** Values used to pre-fill the preset create dialog (e.g. from a transaction). */
export interface PresetInitialValues {
  name: string
  note: string | null
  amount: number // in cents
  type: 'income' | 'expense'
  categoryId: string | null
  isBudget: boolean
}
