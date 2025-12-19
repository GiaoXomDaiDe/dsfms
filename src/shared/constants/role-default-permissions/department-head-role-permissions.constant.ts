import { DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES } from '~/shared/constants/permission.constant'

export const DEPARTMENT_HEAD_DEFAULT_ENDPOINT_PERMISSION_NAMES: readonly string[] = [
  ...DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES,
  'GET /assessments/events',
  'GET /assessments/events/subject',
  'GET /assessments/events/course',
  'GET /assessments/department',
  'PUT /assessments/:assessmentId/approve-reject',
  'GET /assessments',
  'GET /assessments/:assessmentId',
  'GET /assessments/department-events',
  'GET /assessments/sections/:assessmentSectionId/fields',
  'GET /assessments/:assessmentId/sections',
  'GET /templates/pdf/:templateFormId', // có thể xóa
  'GET /departments/me'
]
