import { createZodDto } from 'nestjs-zod'
import {
  AssignPermissionGroupPermissionsBodySchema,
  AssignPermissionGroupPermissionsResSchema,
  CreatePermissionGroupBodySchema,
  PermissionGroupListResSchema,
  PermissionGroupParamsSchema,
  PermissionGroupResSchema,
  UpdatePermissionGroupBodySchema
} from './permission-group.model'

export class PermissionGroupParamsDto extends createZodDto(PermissionGroupParamsSchema) {}
export class CreatePermissionGroupBodyDto extends createZodDto(CreatePermissionGroupBodySchema) {}
export class PermissionGroupResDto extends createZodDto(PermissionGroupResSchema) {}
export class PermissionGroupListResDto extends createZodDto(PermissionGroupListResSchema) {}
export class UpdatePermissionGroupBodyDto extends createZodDto(UpdatePermissionGroupBodySchema) {}
export class AssignPermissionGroupPermissionsBodyDto extends createZodDto(AssignPermissionGroupPermissionsBodySchema) {}
export class AssignPermissionGroupPermissionsResDto extends createZodDto(AssignPermissionGroupPermissionsResSchema) {}
