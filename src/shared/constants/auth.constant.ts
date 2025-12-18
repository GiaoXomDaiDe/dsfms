export const REQUEST_USER_KEY = 'user'
export const REQUEST_ROLE_PERMISSIONS = 'role_permissions'
export const EXCLUDE_PERMISSION_MODULES_KEY = 'excludePermissionModules'

export const RoleName = {
  ADMINISTRATOR: 'ADMINISTRATOR',
  TRAINEE: 'TRAINEE',
  TRAINER: 'TRAINER',
  ACADEMIC_DEPARTMENT: 'ACADEMIC_DEPARTMENT',
  DEPARTMENT_HEAD: 'DEPARTMENT_HEAD',
  SQA_AUDITOR: 'SQA_AUDITOR'
} as const

export type RoleNameType = (typeof RoleName)[keyof typeof RoleName]

export const GenderStatus = {
  MALE: 'MALE',
  FEMALE: 'FEMALE'
} as const

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED'
} as const

export const HTTPMethod = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
  OPTIONS: 'OPTIONS',
  HEAD: 'HEAD'
} as const

export const MESSAGES = {
  401: 'Unauthorized access',
  403: 'Forbidden',
  404: 'Not Found',
  500: 'Internal Server Error'
} as const

export const STATUS_CONST = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  PENDING: 'PENDING',
  SUSPENDED: 'SUSPENDED'
} as const

export const ERROR_MESSAGES = {
  INVALID_EMAIL: 'Invalid email address format'
} as const

export const AuthType = {
  Bearer: 'Bearer',
  ApiKey: 'ApiKey',
  None: 'None'
} as const

export type AuthTypeType = (typeof AuthType)[keyof typeof AuthType]

export const ConditionGuard = {
  And: 'And',
  Or: 'Or'
} as const

export type ConditionGuardType = (typeof ConditionGuard)[keyof typeof ConditionGuard]
