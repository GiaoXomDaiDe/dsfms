import { DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES } from '~/shared/constants/permission.constant'

export const ACADEMIC_DEPARTMENT_DEFAULT_ENDPOINT_PERMISSION_NAMES: readonly string[] = [
  ...DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES,
  'GET /assessments/events',
  'POST /assessments/bulk',
  'POST /assessments',
  'GET /templates/pdf/:templateFormId',
  'GET /templates/department/:departmentId',
  'GET /dashboard/academic/overview',
  'PUT /subjects/:subjectId/trainers/:trainerId',
  'PUT /courses/:courseId/trainers/:trainerId'
]
