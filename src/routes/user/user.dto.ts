import { createZodDto } from 'nestjs-zod'
import { UserMes } from '~/routes/user/user.message'
import {
  BulkCreateResultSchema,
  CreateBulkUsersBodySchema,
  CreateUserBodySchema,
  CreateUserBodyWithProfileSchema,
  GetUserParamsSchema,
  GetUserResSchema,
  GetUsersQuerySchema,
  GetUsersResSchema,
  UpdateUserBodyWithProfileSchema,
  UpdateUserResSchema
} from '~/routes/user/user.model'
import { createResponseDto } from '~/shared/helper'

export class GetUsersQueryDTO extends createZodDto(GetUsersQuerySchema) {}
export class GetUserParamsDTO extends createZodDto(GetUserParamsSchema) {}
export class CreateUserBodyDTO extends createZodDto(CreateUserBodySchema) {}
export class CreateUserBodyWithProfileDTO extends createZodDto(CreateUserBodyWithProfileSchema) {}
export class UpdateUserBodyWithProfileDTO extends createZodDto(UpdateUserBodyWithProfileSchema) {}
export class CreateBulkUsersBodyDTO extends createZodDto(CreateBulkUsersBodySchema) {}

export class GetUsersResDTO extends createResponseDto(GetUsersResSchema, UserMes.LIST_SUCCESS) {}
export class GetUserProfileResDTO extends createResponseDto(GetUserResSchema, UserMes.DETAIL_SUCCESS) {}
export class CreateUserResDTO extends createResponseDto(UpdateUserResSchema, UserMes.CREATE_SUCCESS) {}
export class BulkCreateResultDTO extends createResponseDto(BulkCreateResultSchema, UserMes.BULK_CREATE_SUCCESS) {}
export class UpdateUserResDTO extends createResponseDto(UpdateUserResSchema, UserMes.UPDATE_SUCCESS) {}
