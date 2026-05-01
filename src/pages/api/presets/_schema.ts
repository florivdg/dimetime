import { z } from 'zod'

const presetCommon = {
  note: z.string().max(2000).nullable().optional(),
  type: z.enum(['income', 'expense']).optional(),
  recurrence: z
    .enum(['einmalig', 'monatlich', 'vierteljährlich', 'jährlich'])
    .optional(),
  startMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable()
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  categoryId: z.uuid().nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  isBudget: z.boolean().optional(),
}

export const createPresetSchema = z.object({
  name: z.string().min(1).max(200),
  amount: z.number().int().min(0),
  ...presetCommon,
})

export const updatePresetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  amount: z.number().int().min(0).optional(),
  ...presetCommon,
})
