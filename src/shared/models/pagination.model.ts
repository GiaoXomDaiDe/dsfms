import z from 'zod'
export const PaginationResSchema = z.object({
  totalItems: z.number().positive(),
  page: z.number().positive(),
  limit: z.number().positive(),
  totalPages: z.number().positive()
})

export const PaginationQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().default(10)
  })
  .strict()

export type PaginationResType = z.infer<typeof PaginationResSchema>
export type PaginationQueryType = z.infer<typeof PaginationQuerySchema>
