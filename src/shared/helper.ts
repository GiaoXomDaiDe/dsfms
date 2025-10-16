import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { createZodDto } from 'nestjs-zod'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import z from 'zod'
import { CreateUserBodyWithProfileType } from '~/routes/user/user.model'
import { ROLE_PROFILE_RULES } from '~/shared/constants/role.constant'

export function isUniqueConstraintPrismaError(error: any): error is PrismaClientKnownRequestError {
  return error instanceof PrismaClientKnownRequestError && error.code === 'P2002'
}

export function isNotFoundPrismaError(error: any): error is PrismaClientKnownRequestError {
  return error instanceof PrismaClientKnownRequestError && error.code === 'P2025'
}

export function isForeignKeyConstraintPrismaError(error: any): error is PrismaClientKnownRequestError {
  return error instanceof PrismaClientKnownRequestError && error.code === 'P2003'
}

export function isCannotReachDatabasePrismaError(error: any): error is PrismaClientKnownRequestError {
  return error instanceof PrismaClientKnownRequestError && error.code === 'P1001'
}

// Factory function to create ResponseDTO
export function createResponseDto<T extends z.ZodTypeAny>(dataSchema: T, defaultMessage?: string) {
  const schema = z.object({
    message: z.string().default(defaultMessage || 'Operation successful'),
    data: dataSchema
  })
  return createZodDto(schema)
}

export const validateRoleProfile = (roleName: string, data: CreateUserBodyWithProfileType, ctx: z.RefinementCtx) => {
  const rules = ROLE_PROFILE_RULES[roleName as keyof typeof ROLE_PROFILE_RULES]

  if (rules) {
    const requiredProfile = data[rules.requiredProfile as keyof typeof data]
    const forbiddenProfile = data[rules.forbiddenProfile as keyof typeof data]

    // Kiểm tra required profile
    if (!requiredProfile) {
      ctx.addIssue({
        code: 'custom',
        message: rules.requiredMessage,
        path: [rules.requiredProfile]
      })
    }

    // Kiểm tra forbidden profile
    if (forbiddenProfile) {
      ctx.addIssue({
        code: 'custom',
        message: rules.forbiddenMessage,
        path: [rules.forbiddenProfile]
      })
    }
  } else {
    // Với các role khác, không được có bất kỳ profile nào
    const profiles: Array<'trainerProfile' | 'traineeProfile'> = ['trainerProfile', 'traineeProfile']
    profiles.forEach((profile) => {
      if (data[profile]) {
        ctx.addIssue({
          code: 'custom',
          message: `${profile} is not allowed for ${roleName} role`,
          path: [profile]
        })
      }
    })

    return { isValid: true }
  }
}

export const generateRandomFilename = (filename: string) => {
  const ext = path.extname(filename)
  return `${uuidv4()}${ext}`
}
