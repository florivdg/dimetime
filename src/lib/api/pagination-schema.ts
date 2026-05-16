import { z } from 'zod'

const limitMessage = 'Limit muss -1 (unbegrenzt) oder zwischen 1 und 100 sein'

export const paginationFields = {
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce
    .number()
    .refine((v) => v === -1 || (v >= 1 && v <= 100), {
      message: limitMessage,
    })
    .optional()
    .default(20),
}

export const sortDirField = z.enum(['asc', 'desc']).optional()
