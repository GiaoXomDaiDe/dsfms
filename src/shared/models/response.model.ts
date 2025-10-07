import { z } from 'zod'

export const MessageResSchema = z.object({
  message: z.string()
})

export const PaginationResSchema = z.object({
  totalItems: z.number().positive(),
  page: z.number().positive(),
  limit: z.number().positive(),
  totalPages: z.number().positive()
})

export type MessageResType = z.infer<typeof MessageResSchema>
export type PaginationResType = z.infer<typeof PaginationResSchema>
