import { DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES } from '~/shared/constants/permission.constant'

// Add additional administrator-specific default permissions here if needed.
export const ADMINISTRATOR_DEFAULT_ENDPOINT_PERMISSION_NAMES: readonly string[] = [
  ...DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES,
  'GET /permissions',
  'GET /permissions/:permissionId',
  'POST /permissions',
  'PUT /permissions/:permissionId',
  'PATCH /permissions/:permissionId/enable',
  'DELETE /permissions/:permissionId',
  'POST /templates/parse',
  'PATCH /templates/:id',
  'GET /assessments/:assessmentId/pdf-url' // có thể xóa
]
