export const DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES = [
  'POST /media/images/upload/:type',
  'POST /media/images/upload/presigned-url',
  'POST /media/docs/upload/:type',
  'POST /media/docs/upload/presigned-url',
  'GET /media/static/:filename',
  'POST /media/docs/onlyoffice/submit',
  'PUT /profile/signature',
  'GET /profile',
  'PUT /profile',
  'PUT /profile/reset-password',
  'GET /reports/my-reports',
  'POST /reports',
  'GET /permission-groups',
  'GET /users/:userId',
  'GET /roles/:roleId'
] as const

export type DefaultRoleEndpointPermissionName = (typeof DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES)[number]
