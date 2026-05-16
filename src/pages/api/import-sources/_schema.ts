import { z } from 'zod'

const importSourceCommon = {
  bankName: z.string().max(200).nullable().optional(),
  accountLabel: z.string().max(200).nullable().optional(),
  accountIdentifier: z.string().max(200).nullable().optional(),
  defaultPlanAssignment: z.enum(['auto_month', 'none']).optional(),
  isActive: z.boolean().optional(),
}

export const createSourceSchema = z.object({
  name: z.string().min(1).max(200),
  preset: z.enum(['ing_csv_v1', 'easybank_xlsx_v1']),
  sourceKind: z.enum(['bank_account', 'credit_card', 'other']),
  ...importSourceCommon,
})

export const updateSourceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  preset: z.enum(['ing_csv_v1', 'easybank_xlsx_v1']).optional(),
  sourceKind: z.enum(['bank_account', 'credit_card', 'other']).optional(),
  ...importSourceCommon,
})
