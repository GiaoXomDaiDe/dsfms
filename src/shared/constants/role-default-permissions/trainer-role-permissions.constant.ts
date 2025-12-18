import { DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES } from '~/shared/constants/permission.constant'

export const TRAINER_DEFAULT_ENDPOINT_PERMISSION_NAMES: readonly string[] = [
  ...DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES,
  'GET /assessments/:assessmentId/trainee-sections',
  'GET /assessments/events/course',
  'GET /assessments/events/subject',
  'PUT /assessments/sections/update-values',
  'GET /assessments/sections/:assessmentSectionId/fields',
  'GET /assessments/events',
  'POST /assessments/:assessmentId/submit',
  'PUT /assessments/:assessmentId/trainee-lock',
  'POST /assessments/sections/save-values',
  'GET /assessments',
  'GET /assessments/user-events',
  'GET /assessments/:assessmentId/sections',
  'GET /assessments/course',
  'GET /assessments/subject',
  'GET /assessments/:assessmentId'
  // 'GET /templates/pdf/:templateFormId' // có thể xóa
]
