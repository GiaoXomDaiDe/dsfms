import { createZodDto } from 'nestjs-zod'
import {
  AddPermissionsToRoleBodySchema,
  AddPermissionsToRoleResSchema,
  CreateRoleBodySchema,
  CreateRoleResSchema,
  GetRoleDetailResSchema,
  GetRoleParamsSchema,
  GetRolesQuerySchema,
  GetRolesResSchema,
  UpdateRoleBodySchema,
  UpdateRoleResSchema
} from '~/routes/role/role.model'

export class GetRolesQueryDTO extends createZodDto(GetRolesQuerySchema) {}

export class GetRolesResDTO extends createZodDto(GetRolesResSchema) {}

export class GetRoleParamsDTO extends createZodDto(GetRoleParamsSchema) {}

export class GetRoleDetailResDTO extends createZodDto(GetRoleDetailResSchema) {}

export class CreateRoleBodyDTO extends createZodDto(CreateRoleBodySchema) {}

export class CreateRoleResDTO extends createZodDto(CreateRoleResSchema) {}

export class UpdateRoleBodyDTO extends createZodDto(UpdateRoleBodySchema) {}

export class UpdateRoleResDTO extends createZodDto(UpdateRoleResSchema) {}

export class AddPermissionsToRoleBodyDTO extends createZodDto(AddPermissionsToRoleBodySchema) {}

export class AddPermissionsToRoleResDTO extends createZodDto(AddPermissionsToRoleResSchema) {}
