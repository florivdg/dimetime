import { z } from 'zod'
import { IMPORT_PRESETS } from '@/lib/bank-import/types'

const importSourceCommon = {
  bankName: z.string().max(200).nullable().optional(),
  accountLabel: z.string().max(200).nullable().optional(),
  accountIdentifier: z.string().max(200).nullable().optional(),
  defaultPlanAssignment: z.enum(['auto_month', 'none']).optional(),
  isActive: z.boolean().optional(),
}

export const createSourceSchema = z.object({
  name: z.string().min(1).max(200),
  preset: z.enum(IMPORT_PRESETS),
  sourceKind: z.enum(['bank_account', 'credit_card', 'other']),
  ...importSourceCommon,
})

export const updateSourceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  preset: z.enum(IMPORT_PRESETS).optional(),
  sourceKind: z.enum(['bank_account', 'credit_card', 'other']).optional(),
  ...importSourceCommon,
})
