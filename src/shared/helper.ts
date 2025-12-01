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

  // 1. Nếu có rule cho role này (TRAINER / TRAINEE)
  if (rules) {
    const { requiredProfile, forbiddenProfile, requiredMessage, forbiddenMessage } = rules

    // requiredProfile & forbiddenProfile là key: 'trainerProfile' | 'traineeProfile'
    // data[requiredProfile] / data[forbiddenProfile] có thể là object hoặc undefined/null
    // Dùng !! để convert về boolean:
    //   - truthy (có profile)  -> true
    //   - falsy  (không có)    -> false
    const hasRequired = !!data[requiredProfile] // user có gửi profile bắt buộc cho role này không?
    const hasForbidden = !!data[forbiddenProfile] // user có gửi profile bị cấm cho role này không?

    if (!hasRequired) {
      violations.push({
        type: ROLE_PROFILE_VIOLATION_TYPES.MISSING_REQUIRED,
        profileKey: requiredProfile,
        message: requiredMessage
      })
    }

    if (hasForbidden) {
      violations.push({
        type: ROLE_PROFILE_VIOLATION_TYPES.FORBIDDEN_PRESENT,
        profileKey: forbiddenProfile,
        message: forbiddenMessage
      })
    }

    return violations
  }

  // 2. Các role không có rule (ADMIN, DEPARTMENT_HEAD, ...)
  //    => không được phép có bất kỳ profile nào
  // Dùng for...of thay vì forEach vì:
  // - Ít "callback noise" → đọc thẳng control flow, dễ debug
  // - Cho phép dùng break / continue nếu sau này cần tối ưu
  for (const profileKey of PROFILE_KEYS) {
    if (data[profileKey]) {
      violations.push({
        type: ROLE_PROFILE_VIOLATION_TYPES.UNEXPECTED_PROFILE,
        profileKey,
        message: ProfileNotAllowedForRoleMessage(profileKey, roleName)
      })
    }
  }

  return violations
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

export const generateRandomFilename = (filename: string) => {
  const ext = path.extname(filename)
  return `${uuidv4()}${ext}`
}
