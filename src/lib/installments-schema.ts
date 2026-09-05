import { z } from 'zod'

const MONTH_MESSAGE = 'Ungültiges Monatsformat (erwartet: JJJJ-MM)'

/** `YYYY-MM` with a month between 01 and 12 */
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export const PREPAID_MESSAGE =
  'Bereits gezahlte Raten dürfen die Gesamtanzahl nicht überschreiten'

export const FINAL_AMOUNT_MESSAGE =
  'Eine abweichende Schlussrate ist erst ab zwei Raten möglich'

/**
 * Every field of an installment plan. The create schema adds the cross-field
 * refinement, the update schema is the partial variant of this — both API
 * routes and the form dialog validate against them, so the rules and their
 * German messages exist exactly once.
 */
const installmentBaseSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(200, 'Name ist zu lang'),
  amount: z
    .number({ error: 'Betrag muss eine Zahl sein' })
    .int('Betrag muss eine ganze Zahl sein')
    .min(1, 'Betrag muss größer als 0 sein'),
  finalAmount: z
    .number({ error: 'Schlussrate muss eine Zahl sein' })
    .int('Schlussrate muss eine ganze Zahl sein')
    .min(1, 'Schlussrate muss größer als 0 sein')
    .nullable()
    .optional(),
  totalInstallments: z
    .number({ error: 'Anzahl der Raten muss eine Zahl sein' })
    .int('Anzahl der Raten muss eine ganze Zahl sein')
    .min(1, 'Es muss mindestens eine Rate geben'),
  prepaidInstallments: z
    .number({ error: 'Bereits gezahlte Raten müssen eine Zahl sein' })
    .int('Bereits gezahlte Raten müssen eine ganze Zahl sein')
    .min(0, 'Bereits gezahlte Raten dürfen nicht negativ sein')
    .optional(),
  startMonth: z.string().regex(MONTH_PATTERN, MONTH_MESSAGE),
  dayOfMonth: z
    .number({ error: 'Tag muss eine Zahl sein' })
    .int('Tag muss eine ganze Zahl sein')
    .min(1, 'Tag muss zwischen 1 und 31 liegen')
    .max(31, 'Tag muss zwischen 1 und 31 liegen')
    .nullable()
    .optional(),
  note: z.string().max(2000, 'Notiz ist zu lang').nullable().optional(),
  categoryId: z.uuid('Ungültige Kategorie').nullable().optional(),
})

/**
 * `prepaidInstallments` may never exceed `totalInstallments`. Only checkable
 * when both values are present, which the create schema always guarantees.
 * Exported so the PUT route can run the very same rule over the merged values.
 */
export function prepaidWithinTotal(data: {
  prepaidInstallments?: number
  totalInstallments: number
}): boolean {
  if (data.prepaidInstallments === undefined) return true
  return data.prepaidInstallments <= data.totalInstallments
}

/**
 * A `finalAmount` only means something when there is a rate before it —
 * with a single installment it would silently replace `amount`.
 * Exported so the PUT route can run the very same rule over the merged values.
 */
export function finalAmountNeedsTwoInstallments(data: {
  finalAmount?: number | null
  totalInstallments: number
}): boolean {
  if (data.finalAmount === undefined || data.finalAmount === null) return true
  return data.totalInstallments >= 2
}

export const createInstallmentSchema = installmentBaseSchema
  .refine(prepaidWithinTotal, {
    message: PREPAID_MESSAGE,
    path: ['prepaidInstallments'],
  })
  .refine(finalAmountNeedsTwoInstallments, {
    message: FINAL_AMOUNT_MESSAGE,
    path: ['finalAmount'],
  })

/**
 * Partial variant for PUT — deliberately without the cross-field refinements: a
 * partial body may carry only one of the fields involved, so the route compares
 * the merged values against the stored row instead (and answers with
 * {@link PREPAID_MESSAGE} / {@link FINAL_AMOUNT_MESSAGE} itself).
 */
export const updateInstallmentSchema = installmentBaseSchema.partial()
