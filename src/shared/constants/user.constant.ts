export const ROLE_PROFILE_VIOLATION_TYPES = {
  MISSING_REQUIRED: 'missing-required',
  FORBIDDEN_PRESENT: 'forbidden-present',
  UNEXPECTED_PROFILE: 'unexpected-profile'
} as const

export type RoleProfileViolationType = (typeof ROLE_PROFILE_VIOLATION_TYPES)[keyof typeof ROLE_PROFILE_VIOLATION_TYPES]
