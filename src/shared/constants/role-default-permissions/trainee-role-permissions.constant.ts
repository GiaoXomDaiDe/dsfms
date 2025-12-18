import { DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES } from '~/shared/constants/permission.constant'

export const TRAINEE_DEFAULT_ENDPOINT_PERMISSION_NAMES: readonly string[] = [
  ...DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES,
  'PUT /assessments/:assessmentId/confirm-participation',
  'GET /assessments/sections/:assessmentSectionId/fields',
  'GET /assessments/:assessmentId/pdf-url',
  'GET /assessments/course',
  'GET /assessments/subject',
  'GET /assessments/:assessmentId/sections',
  'POST /assessments/sections/save-values',
  'PUT /assessments/sections/update-values',
  'GET /assessments/trainee',
  'GET /dashboard/trainee/overview'
]
