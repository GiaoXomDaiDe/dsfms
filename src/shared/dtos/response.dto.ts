import { createZodDto } from 'nestjs-zod'
import z from 'zod'
import { MessageResSchema } from '~/shared/models/response.model'

export class MessageResDTO extends createZodDto(MessageResSchema) {}

// Factory function to create ResponseDTO
export function createResponseDto<T extends z.ZodTypeAny>(dataSchema: T, defaultMessage?: string) {
  const schema = z.object({
    message: z.string().default(defaultMessage || 'Operation successful'),
    data: dataSchema
  })
  return createZodDto(schema)
}
