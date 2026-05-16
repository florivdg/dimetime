import { z } from 'zod'

const categoryCommon = {
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9-]+$/,
      'Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten',
    )
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Ungültiges Farbformat (z.B. #FF5733)')
    .nullable()
    .optional(),
}

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(100, 'Name ist zu lang'),
  ...categoryCommon,
})

export const updateCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Name ist erforderlich')
    .max(100, 'Name ist zu lang')
    .optional(),
  ...categoryCommon,
})
