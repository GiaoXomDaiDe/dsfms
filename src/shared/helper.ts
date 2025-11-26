import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { createZodDto } from 'nestjs-zod'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import z from 'zod'
import { ProfileNotAllowedForRoleMessage } from '~/routes/user/user.error'
import { ROLE_PROFILE_RULES } from '~/shared/constants/role.constant'
import { ROLE_PROFILE_VIOLATION_TYPES, RoleProfileViolationType } from '~/shared/constants/user.constant'

const PROFILE_KEYS = ['trainerProfile', 'traineeProfile'] as const
type RoleProfileKey = (typeof PROFILE_KEYS)[number]

type RoleProfileViolation = {
  type: RoleProfileViolationType
  profileKey: RoleProfileKey
  message: string
}

export type RoleProfilePayload = Partial<Record<RoleProfileKey, unknown>>

export const evaluateRoleProfileRules = (roleName: string, data: RoleProfilePayload): RoleProfileViolation[] => {
  const rules = ROLE_PROFILE_RULES[roleName as keyof typeof ROLE_PROFILE_RULES]
  const violations: RoleProfileViolation[] = []

  if (rules) {
    const requiredKey = rules.requiredProfile
    const forbiddenKey = rules.forbiddenProfile

    const requiredProfile = data[requiredKey]
    const forbiddenProfile = data[forbiddenKey]

    if (!requiredProfile) {
      violations.push({
        type: ROLE_PROFILE_VIOLATION_TYPES.MISSING_REQUIRED,
        profileKey: requiredKey,
        message: rules.requiredMessage
      })
    }

    if (forbiddenProfile) {
      violations.push({
        type: ROLE_PROFILE_VIOLATION_TYPES.FORBIDDEN_PRESENT,
        profileKey: forbiddenKey,
        message: rules.forbiddenMessage
      })
    }

    return violations
  }

  PROFILE_KEYS.forEach((profileKey) => {
    if (data[profileKey]) {
      violations.push({
        type: ROLE_PROFILE_VIOLATION_TYPES.UNEXPECTED_PROFILE,
        profileKey,
        message: ProfileNotAllowedForRoleMessage(profileKey, roleName)
      })
    }
  })

  return violations
}

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

export function createResponseDto<T extends z.ZodTypeAny>(dataSchema: T, defaultMessage?: string) {
  const schema = z.object({
    message: z.string().default(defaultMessage || 'Operation successful'),
    data: dataSchema
  })
  return createZodDto(schema)
}

export const validateRoleProfile = (roleName: string, data: RoleProfilePayload, ctx: z.RefinementCtx) => {
  const violations = evaluateRoleProfileRules(roleName, data)

  violations.forEach((violation) => {
    ctx.addIssue({
      code: 'custom',
      message: violation.message,
      path: [violation.profileKey]
    })
  })
}

export const generateRandomFilename = (filename: string) => {
  const ext = path.extname(filename)
  return `${uuidv4()}${ext}`
}
