import { createZodDto } from 'nestjs-zod'
import { RoleMes } from '~/routes/role/role.message'
import {
  AddPermissionsToRoleBodySchema,
  AddPermissionsToRoleResSchema,
  CreateRoleBodySchema,
  CreateRoleResSchema,
  GetRoleDetailResSchema,
  GetRoleParamsSchema,
  GetRolesResSchema,
  RemovePermissionsFromRoleBodySchema,
  RemovePermissionsFromRoleResSchema,
  UpdateRoleBodySchema,
  UpdateRoleResSchema
} from '~/routes/role/role.model'
import { createResponseDto } from '~/shared/helper'

export class GetRoleParamsDTO extends createZodDto(GetRoleParamsSchema) {}
export class CreateRoleBodyDTO extends createZodDto(CreateRoleBodySchema) {}
export class UpdateRoleBodyDTO extends createZodDto(UpdateRoleBodySchema) {}
export class AddPermissionsToRoleBodyDTO extends createZodDto(AddPermissionsToRoleBodySchema) {}
export class RemovePermissionsFromRoleBodyDTO extends createZodDto(RemovePermissionsFromRoleBodySchema) {}

export class GetRolesResDTO extends createResponseDto(GetRolesResSchema, RoleMes.LIST_SUCCESS) {}
export class GetRoleDetailResDTO extends createResponseDto(GetRoleDetailResSchema, RoleMes.DETAIL_SUCCESS) {}
export class CreateRoleResDTO extends createResponseDto(CreateRoleResSchema, RoleMes.CREATE_SUCCESS) {}
export class UpdateRoleResDTO extends createResponseDto(UpdateRoleResSchema, RoleMes.UPDATE_SUCCESS) {}

//dùng cho internal
export class AddPermissionsToRoleResDTO extends createResponseDto(
  AddPermissionsToRoleResSchema,
  RoleMes.ADD_PERMISSIONS_SUCCESS
) {}
export class RemovePermissionsFromRoleResDTO extends createResponseDto(
  RemovePermissionsFromRoleResSchema,
  RoleMes.REMOVE_PERMISSIONS_SUCCESS
) {}
