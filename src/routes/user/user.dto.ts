import { createZodDto } from 'nestjs-zod'
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

export class GetUsersQueryDTO extends createZodDto(GetUsersQuerySchema) {}

export class GetUsersResDTO extends createZodDto(GetUsersResSchema) {}

export class GetUserParamsDTO extends createZodDto(GetUserParamsSchema) {}

/**
 * Áp dụng cho Response của api GET('profile') và GET('users/:userId')
 */
export class GetUserProfileResDTO extends createZodDto(GetUserResSchema) {}

export class CreateUserBodyDTO extends createZodDto(CreateUserBodySchema) {}

export class CreateUserBodyWithProfileDTO extends createZodDto(CreateUserBodyWithProfileSchema) {}

export class UpdateUserBodyWithProfileDTO extends createZodDto(UpdateUserBodyWithProfileSchema) {}

export class CreateBulkUsersBodyDTO extends createZodDto(CreateBulkUsersBodySchema) {}

export class BulkCreateResultDTO extends createZodDto(BulkCreateResultSchema) {}

/**
 * Áp dụng cho Response của api PUT('profile') và PUT('users/:userId')
 */
export class UpdateUserResDTO extends createZodDto(UpdateUserResSchema) {}

export class CreateUserResDTO extends UpdateUserResDTO {}
