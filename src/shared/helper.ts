import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { createZodDto } from 'nestjs-zod'
import z from 'zod'

export function isUniqueConstraintPrismaError(error: any): error is PrismaClientKnownRequestError {
  return error instanceof PrismaClientKnownRequestError && error.code === 'P2002'
}

export function isNotFoundPrismaError(error: any): error is PrismaClientKnownRequestError {
  return error instanceof PrismaClientKnownRequestError && error.code === 'P2025'
}

export function isForeignKeyConstraintPrismaError(error: any): error is PrismaClientKnownRequestError {
  return error instanceof PrismaClientKnownRequestError && error.code === 'P2003'
}

// Factory function to create ResponseDTO
export function createResponseDto<T extends z.ZodTypeAny>(dataSchema: T, defaultMessage?: string) {
  const schema = z.object({
    message: z.string().default(defaultMessage || 'Operation successful'),
    data: dataSchema
  })
  return createZodDto(schema)
}
