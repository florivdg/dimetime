import { z } from 'zod'

const MONTH_MESSAGE = 'Ungültiges Monatsformat (erwartet: JJJJ-MM)'

/** `YYYY-MM` with a month between 01 and 12 */
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export const PREPAID_MESSAGE =
  'Bereits gezahlte Raten dürfen die Gesamtanzahl nicht überschreiten'

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
 */
function prepaidWithinTotal(data: {
  prepaidInstallments?: number
  totalInstallments: number
}): boolean {
  if (data.prepaidInstallments === undefined) return true
  return data.prepaidInstallments <= data.totalInstallments
}

export const createInstallmentSchema = installmentBaseSchema.refine(
  prepaidWithinTotal,
  { message: PREPAID_MESSAGE, path: ['prepaidInstallments'] },
)

/**
 * Partial variant for PUT — deliberately without the prepaid refinement: a
 * partial body may carry only one of the two fields, so the route compares the
 * merged values against the stored row instead (and answers with
 * {@link PREPAID_MESSAGE} itself).
 */
export const updateInstallmentSchema = installmentBaseSchema.partial()
