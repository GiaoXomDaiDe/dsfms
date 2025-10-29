import { createZodDto } from 'nestjs-zod'
import {
  CreatePermissionBodySchema,
  GetPermissionDetailResSchema,
  GetPermissionParamsSchema,
  GetPermissionsQuerySchema,
  GetPermissionsResSchema,
  UpdatePermissionBodySchema
} from '~/routes/permission/permission.model'
import { createResponseDto } from '~/shared/helper'

export class GetPermissionsQueryDTO extends createZodDto(GetPermissionsQuerySchema) {}

export class GetPermissionParamsDTO extends createZodDto(GetPermissionParamsSchema) {}

export class GetPermissionsResDTO extends createResponseDto(GetPermissionsResSchema) {}

export class GetPermissionDetailResDTO extends createZodDto(GetPermissionDetailResSchema) {}

export class CreatePermissionBodyDTO extends createZodDto(CreatePermissionBodySchema) {}

export class UpdatePermissionBodyDTO extends createZodDto(UpdatePermissionBodySchema) {}
