export const RoleName = {
  ADMINISTRATOR: 'ADMINISTRATOR',
  TRAINEE: 'TRAINEE',
  TRAINER: 'TRAINER',
  DEPARTMENT_HEAD: 'DEPARTMENT_HEAD',
  SQA_AUDITOR: 'SQA_AUDITOR'
} as const

export const GenderStatus = {
  MALE: 'MALE',
  FEMALE: 'FEMALE'
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
} as const;

export const STATUS_CONST = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  PENDING: 'PENDING',
  SUSPENDED: 'SUSPENDED'
} as const;

export const ERROR_MESSAGES = {
  INVALID_EMAIL: 'Invalid email address format',
} as const;