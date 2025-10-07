import z from 'zod'

//Query cho includeDeleted
export const IncludeDeletedQuerySchema = z.object({
  includeDeleted: z.coerce.boolean().default(false).optional()
})

//Query cho phân trang
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().default(10).optional()
})

//Query cho search
export const SearchQuerySchema = z.object({
  search: z.string().trim().optional()
})

export type PaginationQueryType = z.infer<typeof PaginationQuerySchema>
export type IncludeDeletedQueryType = z.infer<typeof IncludeDeletedQuerySchema>
export type SearchQueryType = z.infer<typeof SearchQuerySchema>
