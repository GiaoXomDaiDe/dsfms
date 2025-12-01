import { createZodDto } from 'nestjs-zod'
import { UserMes } from '~/routes/user/user.message'
import {
  BulkCreateResSchema,
  CreateBulkUsersBodySchema,
  CreateUserBodySchema,
  GetUserParamsSchema,
  GetUserResSchema,
  GetUsersResSchema,
  UpdateUserBodySchema,
  UpdateUserResSchema
} from '~/routes/user/user.model'
import { createResponseDto } from '~/shared/helper'

export class GetUserParamsDTO extends createZodDto(GetUserParamsSchema) {}
export class CreateUserBodyDTO extends createZodDto(CreateUserBodySchema) {}
export class CreateBulkUsersBodyDTO extends createZodDto(CreateBulkUsersBodySchema) {}
export class UpdateUserBodyDTO extends createZodDto(UpdateUserBodySchema) {}

export class GetUsersResDTO extends createResponseDto(GetUsersResSchema, UserMes.LIST_SUCCESS) {}
export class GetUserResDTO extends createResponseDto(GetUserResSchema, UserMes.DETAIL_SUCCESS) {}
export class CreateUserResDTO extends createResponseDto(UpdateUserResSchema, UserMes.CREATE_SUCCESS) {}
export class BulkCreateResDTO extends createResponseDto(BulkCreateResSchema, UserMes.BULK_CREATE_SUCCESS) {}
export class UpdateUserResDTO extends createResponseDto(UpdateUserResSchema, UserMes.UPDATE_SUCCESS) {}
