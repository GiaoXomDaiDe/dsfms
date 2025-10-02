import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

// Response schema
export const ParseTemplateResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  schema: z.record(z.string(), z.any()).optional(),
  placeholders: z.array(z.string()).optional()
})

export class ParseTemplateResponseDTO extends createZodDto(ParseTemplateResponseSchema) {}

export type ParseTemplateResponseType = z.infer<typeof ParseTemplateResponseSchema>
