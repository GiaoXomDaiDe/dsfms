export const DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES = [
  'POST /media/images/upload/:type',
  'POST /media/images/upload/presigned-url',
  'POST /media/docs/upload/:type',
  'POST /media/docs/upload/presigned-url',
  'GET /media/static/:filename',
  'PUT /profile/signature',
  'GET /profile',
  'PUT /profile',
  'PUT /profile/reset-password',
  'GET /permission-groups',
  'GET /users/:userId',
  'GET /roles/:roleId'
] as const

export type DefaultRoleEndpointPermissionName = (typeof DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES)[number]
